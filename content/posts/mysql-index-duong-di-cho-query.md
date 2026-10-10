---
title: "MySQL Index: The Path a Query Takes (Written for Backend Developers)"
date: 2026-01-20T00:00:00+07:00
draft: false
author: "Free Peak"
tags: ["mysql", "database", "index", "performance", "backend"]
categories: ["Database", "Backend"]
description: "An index is not a speed-up charm. It is a path. How MySQL actually uses indexes, from a backend developer point of view: designing indexes for real queries, the anti-patterns you hit, and a checklist you can apply."
summary: "An index is only fast when the query takes the right path. A practical lens for backend developers: start from the queries that matter, write sargable conditions, design composite indexes in the real filter/sort order, and verify with EXPLAIN."
cover:
    image: "/images/posts/mysql-index-duong-di-cho-query/cover.svg"
    alt: "MySQL Index for Backend Performance"
---

Tôi làm backend.

Nên tôi từng đi qua một giai đoạn rất “thẳng”: query chậm thì thêm index.

Nó cũng giống như lúc bạn thấy đường kẹt xe, bạn nghĩ “thêm một làn nữa là xong”. Thỉnh thoảng đúng. Nhưng đa phần là… bạn chỉ dời điểm kẹt từ chỗ này sang chỗ khác, và tự nhiên chi phí bảo trì đường tăng lên.

MySQL index cũng vậy.

Nó làm query nhanh lên thật. Nhưng nó không miễn phí. Và quan trọng hơn: nó chỉ nhanh khi query đi đúng đường.

## The original question: in what order does your query want to travel?

Một query phổ biến trong backend thường làm 3 việc:

- Lọc dữ liệu (`WHERE`)
- Sắp xếp (`ORDER BY`)
- Lấy ít thôi (`LIMIT`, phân trang)

Nếu không có index phù hợp, MySQL sẽ phải:

- quét nhiều dòng hơn cần thiết
- hoặc lọc xong mới sort (`Using filesort`)
- hoặc vừa sort vừa đọc bảng quá nhiều (I/O tăng, CPU tăng)

Nói cho gọn: vấn đề không nằm ở việc “có index hay không”, mà nằm ở việc “index hiện tại có đúng với đường lọc/sort của query hay không”.

## Every choice has a cost (the backend constraint)

Tôi hay gặp 3 kiểu “đời sống” khi đụng index:

1) Read-heavy: API phải nhanh, p95 quan trọng.
2) Write-heavy: insert/update nhiều, index thêm vào là write chậm thấy rõ.
3) Bảng lớn dần: query đang ổn sẽ tự nhiên xuống cấp theo thời gian.

Và vì mỗi lựa chọn đều có giá, nên index không nên được tạo theo cảm giác.

Bạn tạo index là bạn đang ký vào một “hợp đồng”:

- nhanh hơn cho một nhóm query
- đổi lại tốn dung lượng
- và tốn chi phí ghi cho mọi mutation

## In practice users only care about 3 things

Nếu bỏ hết thuật ngữ đi thì cuối cùng vẫn là:

1) API trả nhanh hơn
2) Giảm chi phí vận hành
3) Giảm nguy cơ incident

Bạn có thể giải thích B-Tree với đồng nghiệp cả buổi. Nhưng nếu endpoint list đơn hàng vẫn 3–4 giây thì sản phẩm vẫn đau.

## Definitions that sound good, reality that traps you

### MySQL 8+ sometimes skips an index on its own (low selectivity)

Có một cảm giác rất dễ gây hoang mang: bạn đã tạo index rồi, nhưng `EXPLAIN` vẫn cho thấy MySQL quét bảng.

Với MySQL 8 trở lên, chuyện này lại càng “bình thường” hơn, vì optimizer có nhiều thông tin/cost model tốt hơn để tự quyết.

Trường hợp hay gặp nhất là **độ chọn lọc thấp**.

Ví dụ cột `status` chỉ có vài giá trị kiểu `PAID | PENDING | CANCELLED`. Nếu hệ thống của bạn có 30% đơn hàng ở trạng thái `PAID`, thì query:

```sql
SELECT id, status, created_at
FROM orders
WHERE status = 'PAID';
```

có thể phải đọc một phần rất lớn của bảng.

Trong tình huống đó, đi theo index `status` đôi khi còn tệ hơn:

- MySQL đọc index để lấy rất nhiều `row_id`.
- Sau đó phải "quay lại" bảng để đọc dữ liệu thật (random I/O).

Nên optimizer có thể chọn quét bảng (sequential I/O) và filter trong quá trình đọc.

Dấu hiệu nhận biết trong `EXPLAIN`:

- `possible_keys` có index (ví dụ `idx_status`)
- nhưng `key = NULL`
- `type = ALL`
- `rows` ước lượng lớn

![MySQL 8+ skip index (selectivity thấp)](/images/posts/mysql-index-duong-di-cho-query/skip-index-low-selectivity.svg)

Định nghĩa kiểu sách giáo khoa: index giúp tăng tốc truy vấn.

Đúng.

Nhưng đời thật là: index chỉ giúp nếu query có thể dùng index đó một cách “tử tế”.

Và có vài thứ khiến MySQL “bó tay”, dù bạn có index:

- Bọc cột bằng hàm trong `WHERE`
- Ép kiểu lộn xộn
- `LIKE '%keyword%'`
- `OR` tùy tiện
- OFFSET phân trang quá lớn

Những thứ này làm bạn cảm giác “mình đã có index rồi mà vẫn chậm”.

Thực ra là query đang đi sai đường.

## One lens that is easy to use: start from the important query, not the table

Đừng hỏi: “Bảng orders cần index gì?”

Hãy hỏi:

- Endpoint nào gọi nhiều nhất?
- Query nào nóng nhất (top slow queries / APM)?
- Nó lọc theo cột nào?
- Nó sort theo cột nào?
- Nó phân trang kiểu gì?

Khi bạn trả lời được 4–5 câu đó, index tự nhiên “hiện hình”.

## A 3-step framework (enough for backend developers)

### Step 1: Write the query the way MySQL can use an index

Một anti-pattern kinh điển:

```sql
WHERE DATE(created_at) = '2026-01-01'
```

Bạn nhìn thấy “hợp lý” vì bạn đang nghĩ theo ngôn ngữ người. Nhưng MySQL thì thấy: “bạn bắt tôi tính DATE() cho mọi dòng, rồi mới so sánh”.

Cách viết tốt hơn:

```sql
WHERE created_at >= '2026-01-01'
  AND created_at <  '2026-01-02'
```

Ngắn gọn: muốn dùng index thì đừng bọc cột bằng hàm trong điều kiện lọc.

### Step 2: Design the index in the real filter/sort order

Giả sử backend có endpoint list đơn hàng của user:

```sql
SELECT id, status, created_at, total_amount
FROM orders
WHERE user_id = ?
  AND status = ?
ORDER BY created_at DESC
LIMIT 20;
```

Index hợp lý thường là index ghép:

```sql
CREATE INDEX idx_orders_user_status_created
ON orders(user_id, status, created_at DESC);
```

Lý do:

- `user_id` và `status` là điều kiện `=` giúp thu hẹp tập dữ liệu nhanh
- `created_at` phục vụ `ORDER BY ... DESC` để tránh sort và trả nhanh `LIMIT 20`

Một lỗi hay gặp là tạo index theo kiểu “mình thấy cột created_at quan trọng” rồi đặt nó lên đầu. Nhưng nếu query luôn bắt đầu bằng `user_id`, bạn đặt `user_id` lên trước thường đúng hơn.

Bạn không cần nhớ quá nhiều lý thuyết. Chỉ cần nhớ quy tắc “leftmost prefix” của index ghép:

- `(user_id, status, created_at)` dùng tốt khi query có `user_id` trước
- thiếu `user_id` thì các cột sau khó phát huy

### Step 3: Use EXPLAIN to confirm, not faith

Sau khi tạo index, chạy:

```sql
EXPLAIN
SELECT ...
```

Những dấu hiệu bạn muốn thấy:

- `key` là index bạn vừa tạo (không phải NULL)
- `type` không phải `ALL`
- `rows` ước lượng giảm mạnh
- hạn chế `Using filesort` khi bạn đã thiết kế index để ăn `ORDER BY`

Thói quen tốt: “tạo index xong là phải kiểm chứng”, không phải “cảm giác thấy ổn”.

## Anti-pattern: adding an index out of fear, and the price behind it

Nhiều team đi vào vòng lặp:

- Query chậm → thêm index
- Lại có query khác chậm → thêm index
- Một thời gian sau: write chậm, replication lag, disk phình, buffer pool căng

Index kiểu này giống mua thêm đồ nghề vì sợ thiếu. Lúc đầu có tác dụng. Nhưng về sau nó thành gánh nặng vận hành.

Một câu hỏi nên tự hỏi trước khi thêm index:

“Index này cứu endpoint nào, tần suất bao nhiêu, và đánh đổi gì cho write?”

## Pagination: large OFFSET is a performance killer

Pagination kiểu:

```sql
LIMIT 20 OFFSET 20000
```

OFFSET càng lớn thì MySQL càng phải đọc/đi qua nhiều dòng rồi mới trả 20 dòng bạn cần.

Nếu endpoint quan trọng và dữ liệu lớn, cân nhắc keyset pagination:

```sql
SELECT id, status, created_at, total_amount
FROM orders
WHERE user_id = ?
  AND status = ?
  AND created_at < ?
ORDER BY created_at DESC
LIMIT 20;
```

Khi đó index `(user_id, status, created_at)` gần như “đúng sách”.

## A quick checklist (for backend developers)

- Bắt đầu từ query thật (hot path), không bắt đầu từ “bảng này nên có gì”.
- Tránh điều kiện phá index: hàm trên cột, ép kiểu, `LIKE '%...%'`.
- Index ghép: ưu tiên cột lọc `=` trước, rồi đến cột phục vụ sort/range.
- `ORDER BY` + `LIMIT` là cơ hội tối ưu rất lớn nếu index đúng.
- OFFSET lớn: cân nhắc keyset pagination.
- Mỗi index là chi phí ghi + dung lượng + bảo trì. Đừng tạo cho yên tâm.

## Closing on one principle

Index không phải bùa.

Index là đường đi.

Muốn query nhanh, bạn không cần nhiều đường. Bạn cần đúng đường, và viết query để đi đúng đường đó.

Nếu bạn muốn, gửi mình 1–2 query đang chậm (kèm schema các cột liên quan và ước lượng số bản ghi). Tôi sẽ gợi ý index cụ thể và chỉ ra điểm nào khiến optimizer đang chọn plan không như bạn kỳ vọng.
