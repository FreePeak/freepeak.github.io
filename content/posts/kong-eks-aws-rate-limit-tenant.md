---
title: "Kong DB-less trên AWS EKS: Rate Limiting theo Tenant, và vì sao ALB Ingress không đủ"
date: 2026-01-19T10:00:00+07:00
draft: false
author: "FreePeak Labs"
tags: ["Kong", "AWS", "EKS", "API Gateway", "Rate Limiting", "ALB", "WAF", "GitOps"]
categories: ["Architecture", "DevOps"]
description: "Một góc nhìn thực dụng về việc triển khai Kong DB-less trên AWS EKS để giải quyết bài toán rate limiting theo tenant: vì sao ALB Ingress/WAF/Lambda nhanh chóng thành 'băng keo', và best practices để vận hành Kong gọn, an toàn, dễ scale."
summary: "Nếu bạn cần rate limit theo identity (tenant/API key/JWT claim) trên EKS, ALB Ingress sẽ đẩy bạn vào vòng xoáy WAF/Lambda/custom code. Kong DB-less cho bạn một điểm quyết định ở Layer 7: plugin, consumer, config-as-code, GitOps. Bài viết này chốt kiến trúc và best practices triển khai."
ShowToc: true
TocOpen: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowShareButtons: true
ShowCodeCopyButtons: true
cover:
  image: "/images/posts/kong-eks-aws-rate-limit-tenant/cover.svg"
  alt: "Kong DB-less on EKS"
  caption: ""
  relative: false
  hidden: false
---

Nếu muốn làm một hệ thống sập, đôi khi bạn không cần DDoS.

Chỉ cần một chỗ đứng đủ gần "cửa".

Và một cấu hình đủ ngây thơ.

Trên AWS EKS, cái "cửa" đó thường là Ingress.

Cái ngây thơ thường là: "ALB Ingress là đủ rồi".

Tôi cũng từng tin như vậy.

Cho đến khi bài toán không còn là routing nữa, mà là *kiểm soát hành vi*.

Cụ thể: **rate limiting theo tenant**.

Bạn có 1 API. Nhưng bạn có nhiều khách hàng. Một số khách hàng trả tiền nhiều. Một số trả tiền ít. Một số trả tiền rất ít, nhưng request rất nhiều.

Nếu bạn giới hạn theo IP, bạn đang phạt nhầm người vô tội (NAT gateway làm điều đó giúp bạn).

Nếu bạn giới hạn theo path, bạn đang giả vờ như tenant không tồn tại.

Bạn phải giới hạn theo identity: API key, JWT claim, consumer id… nói chung là theo "người đang gọi", không phải theo "địa chỉ nhà họ".

Đến đây, ALB bắt đầu lộ vẻ mặt: tôi là load balancer, đừng bắt tôi làm gateway.

## 0) Mục lục nhanh

1. Bài toán thật sự: rate limiting theo identity
2. Decision tree: ALB/WAF/Lambda vs Kong
3. Vì sao DB-less hợp EKS
4. Kiến trúc đề xuất trên EKS
5. Guardrails vận hành (best practices)
6. Ví dụ cấu hình tối giản
7. Kết

## 1) Bài toán thật sự: rate limiting theo identity (không phải theo IP)

Nghe thì đơn giản: "giới hạn request".

Nhưng trong các hệ thống SaaS nghiêm túc, giới hạn ở đâu và theo cái gì mới là phần làm bạn mất ngủ.

Vì gateway là một thứ giống như bệnh viện trong bài của vnhacker: ai cũng đi qua, dữ liệu/traffic cực nhạy cảm cứ thế chảy vào, còn bên trong thì không ai muốn nghĩ sâu.

Cho đến khi có sự cố.

- Giới hạn theo IP: dễ làm, nhưng sai mô hình. Một NAT gateway có thể làm bạn phạt nhầm cả công ty.
- Giới hạn theo path: cũng dễ làm, nhưng không phân biệt được tenant.
- Giới hạn theo identity: đúng bài. Nhưng identity lại đến từ nhiều nguồn: API key, JWT claim (sub/tenant_id), header do upstream inject, mTLS client cert...

Lúc này, thứ bạn cần không phải là “một con ALB đứng trước Ingress”. Bạn cần một điểm quyết định ở Layer 7, nơi request được hiểu theo ngữ nghĩa: ai gọi, gói nào, quota nào, và nếu vượt thì trả về 429 một cách nhất quán.

Nôm na: **bạn cần API Gateway hơn là Ingress**.

## 2) Decision tree kiểu kỹ sư: ALB/WAF/Lambda hay một gateway đúng nghĩa?

![Decision tree: ALB/WAF/Lambda vs Kong DB-less](/images/posts/kong-eks-aws-rate-limit-tenant/decision-tree.svg)

Tôi từng đi qua đủ các nhánh, nên xin kể theo kiểu “đường nào cũng có giá”.

### Nhánh A: Cố nhét logic vào ALB Ingress
ALB Ingress mạnh ở chỗ: routing, TLS termination, integration với AWS ecosystem.

Nhưng khi bạn đòi rate limiting theo tenant, bạn sẽ bắt đầu thấy mình viết thêm thứ mà bạn không định vận hành:

- Một lớp “tự nhận diện tenant” (parse JWT, map API key -> tenant)
- Một nơi lưu state/quota (counter, window, redis/elasticache?)
- Một chỗ enforce + trả lỗi chuẩn

Tức là bạn đang lắp một cái gateway bằng… các mảnh khác nhau.

### Nhánh B: Dùng AWS WAF
WAF làm tốt một số thứ: IP reputation, bot control, rule matching.

Nhưng với rate limiting theo identity, WAF thường khiến bạn rơi vào 2 tình huống:

- Quy tắc trở nên khó đọc/khó quản: đội app không hiểu, đội platform ôm hết.
- Chi phí và vận hành bắt đầu tăng theo traffic, và mỗi thay đổi lại giống “xin phép một bộ phận khác”.

WAF không tệ. Chỉ là nó không sinh ra để trở thành “quota engine theo tenant”.

### Nhánh C: Viết Lambda/custom authorizer
Đây là con đường hấp dẫn nhất, vì nó cho bạn cảm giác “mình kiểm soát được hết”.

Nhưng nó cũng là con đường dễ biến thành nợ dài hạn:

- Bạn tự chịu trách nhiệm latency (cold start, retry, error handling)
- Bạn tự xây observability (metrics, logs, correlation)
- Bạn tự định nghĩa chuẩn hành vi (429, headers, backoff hints)

Tới một ngày, bạn nhận ra: bạn vừa dựng một API Gateway mini, nhưng không có đội ngũ của Kong.

### Nhánh D: Dùng Kong DB-less trên EKS
Kong giải đúng cái bạn đang thiếu: một gateway layer 7 với model “consumer + credential + plugin”.

- Rate limiting là plugin, không phải dự án.
- Nhận diện tenant là cấu hình (theo key-auth/jwt/oauth2), không phải mỗi service tự chế.
- Hành vi thống nhất: 429, headers, policy, metrics.

Và quan trọng: **DB-less** cho bạn một style vận hành phù hợp Kubernetes.

## 3) DB-less trên EKS: vì sao đây thường là best practice

Tôi không nói DB-less là “chân lý cho mọi trường hợp”. Nhưng trên EKS, với mục tiêu tối giản vận hành, DB-less gần như là lựa chọn mặc định tốt.

**DB-less nghĩa là:** Kong không cần Postgres để lưu config runtime. Thay vào đó, config được cung cấp theo kiểu declarative. Trong Kubernetes, bạn kéo nó về “configuration as code”.

Lợi ích thực dụng:

- Không phải vận hành Postgres HA chỉ để chứa config gateway.
- Kong proxy gần như stateless: scale ngang dễ, rollout rõ ràng.
- Hợp GitOps: config nằm trong Git, review được, audit được.

Đổi lại, bạn chấp nhận:

- Muốn thay đổi config “nhanh bằng UI” thì không còn vui nữa; bạn commit Git rồi deploy.

Nói thẳng: nếu bạn đã chạy EKS nghiêm túc, bạn **nên** thích cách làm này.

## 4) Kiến trúc đề xuất trên AWS EKS (tối giản nhưng không ngây thơ)

![Architecture: Client -> ALB -> Kong -> Services](/images/posts/kong-eks-aws-rate-limit-tenant/architecture.svg)

Một kiến trúc “đủ tốt” và dễ mở rộng thường trông như sau:

`Client -> AWS ALB (L7) -> Kong Proxy (K8s Service) -> Services trong cluster`

Một số điểm chốt:

- **ALB vẫn có chỗ đứng**: nó lo TLS/ACM, internet-facing LB, integration với AWS networking.
- **Kong là nơi ra quyết định**: auth, rate limit, request/response transform, logging.
- **Services phía sau sạch sẽ hơn**: code tập trung vào business logic.

Nếu bạn muốn đi xa hơn (multi-tenant mạnh, internal traffic, east-west), bạn có thể tách:

- Một Kong “edge” cho traffic ngoài vào
- Một Kong “internal” cho traffic nội bộ (tùy mức độ phức tạp)

Nhưng YAGNI: đừng làm hai con gateway chỉ vì… nhìn cho giống big tech.

## 5) Guardrails triển khai Kong DB-less trên EKS (best practices)

Tôi gọi đây là guardrails, không phải best practices.

Vì best practices nghe như khuyến nghị.

Còn guardrails là thứ bạn dựng lên để giảm blast radius khi có người (hoặc một script) đẩy nhầm config.

### 5.1) Treat gateway config như product: GitOps và review trước khi apply
Nếu gateway là cửa ngõ, thì config của nó là “policy của công ty”.

- Lưu toàn bộ Kong config trong Git.
- Mọi thay đổi đi qua PR review.
- Dùng ArgoCD/Flux để sync vào cluster.

Đừng để gateway trở thành nơi “ai cũng có thể bấm” nhưng “không ai chịu trách nhiệm”.

### 5.2) Tuyệt đối khóa Admin API (đừng để nó sống như một public endpoint)
Nguyên tắc sống còn:

- Admin API để `ClusterIP`.
- Nếu cần thao tác khẩn: dùng `kubectl port-forward` + RBAC.

Bạn có thể có 100 lớp auth cho traffic client. Nhưng nếu Admin API hở, thì coi như xong.

### 5.3) Rate limiting theo tenant: chọn identity source rõ ràng
Trước khi bật plugin, hãy trả lời một câu:

“Tenant identity đến từ đâu?”

- API key -> map thẳng consumer
- JWT -> tiêu chuẩn hóa claim (ví dụ `tenant_id`) và enforce ở gateway

Đừng để mỗi service tự parse theo một kiểu. Bạn sẽ không debug nổi khi có incident.

### 5.4) Tránh global plugin trừ khi bạn thật sự cần
Global plugin nhìn rất tiện. Nhưng nó cũng là cách nhanh nhất để:

- Phạt nhầm những route không nên bị phạt
- Tạo coupling vô hình giữa các team

Best practice thường là:

- Apply plugin theo Ingress/Service/Route cụ thể
- Chỉ globalize những thứ mang tính “hạ tầng” (correlation id, baseline logging)

### 5.5) Observability không phải đồ trang trí
Một gateway không có metrics/logs thì chỉ là một hộp đen biết trả 502.

- Bật access logs có cấu trúc (JSON) và đẩy về hệ thống tập trung.
- Xuất metrics (Prometheus) và đặt alert cho 4 thứ: latency, 429 rate, 5xx rate, upstream timeouts.

Rate limiting theo tenant mà không đo tenant nào bị 429 nhiều nhất thì… bạn chỉ đang đoán.

## 6) Một ví dụ cấu hình (tối giản) để hình dung

![Rate limiting flow: identity -> consumer -> plugin -> 429](/images/posts/kong-eks-aws-rate-limit-tenant/rate-limit-flow.svg)

Dưới đây là ví dụ dạng “minh họa ý tưởng” (tùy bạn đang dùng CRDs hay decK).

- Một consumer đại diện cho tenant
- Một credential (API key hoặc JWT)
- Một rate limiting plugin gắn vào route/service

```yaml
# Pseudo-example: minh họa, không phải manifest đầy đủ
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rl-tenant-basic
config:
  minute: 120
  policy: local
plugin: rate-limiting
```

Ghi chú thực dụng:

- `policy: local` đơn giản nhất (đếm theo từng pod). Nếu bạn cần quota “toàn cụm” chính xác hơn, bạn sẽ cân nhắc Redis.
- Đừng tối ưu quá sớm. Hãy bắt đầu với cái bạn vận hành được.

## 7) Kết

ALB Ingress là một default hợp lý. Nhưng nó không phải là API Gateway.

Khi bài toán của bạn là **rate limiting theo tenant**, bạn đang chơi một trò khác: trò của identity, policy, và vận hành nhất quán.

Kong DB-less trên EKS là một lựa chọn thực dụng vì nó biến “logic ở cửa ngõ” thành cấu hình có kiểm soát: review được, audit được, rollout được.

Nếu phải chốt một câu để nhớ:

**Gateway là nơi bạn quyết định ai được làm gì. Đừng biến quyết định đó thành một đống băng keo.**
