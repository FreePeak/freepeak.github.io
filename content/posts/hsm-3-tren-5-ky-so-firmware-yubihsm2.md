---
title: "HSM Và Nghi Lễ Ký 3-trên-5: Biến Code Signing Từ Script Thành Quy Trình"
date: 2026-01-21T10:00:00+07:00
draft: false
author: ""
tags: ["security", "pki", "hsm", "firmware", "supply-chain"]
categories: ["Security", "Architecture"]
description: "Một cách nhìn thực dụng về HSM khi tích hợp vào hệ thống ký firmware: chọn model, vòng đời key, và vì sao 3-trên-5 giúp giảm rủi ro mà vẫn giữ được tốc độ release."
summary: "HSM không chỉ là một thiết bị phần cứng. Nó là cách ép quy trình ký số (vốn hay bị biến thành script trong CI) trở lại thành một nghi lễ có ràng buộc: key không rời khỏi thiết bị, người ký phải xuất hiện, và chữ ký cần đủ người đồng thuận."
cover:
  image: "/images/posts/hsm-3-tren-5-ky-so-firmware-yubihsm2/cover.svg"
  alt: "HSM 3-of-5 signing ceremony"
---

Có một thời gian tôi nhìn code signing như một bước “phụ” trong pipeline.

- Build xong.
- Ký.
- Đẩy OTA.

Nhưng càng làm với firmware, tôi càng thấy “ký” không phải là một bước kỹ thuật đơn lẻ. Nó là một quyết định quản trị rủi ro.

Vì nếu private key ký firmware bị lộ, thứ bạn mất không chỉ là một artifact. Bạn mất niềm tin của cả chuỗi cung ứng.

## Câu hỏi gốc: Mình đang ký để bảo vệ cái gì?

Định nghĩa nghe rất đẹp: “ký số để đảm bảo tính toàn vẹn và xác thực”.

Đọc xong vẫn có cảm giác… trừu tượng.

Đến khi đặt lại câu hỏi cho đúng:

- Mình đang bảo vệ *binary* hay bảo vệ *quyền phát hành*?
- Kẻ tấn công cần hack build server, hay chỉ cần lấy được private key?

Nếu private key nằm trong một file `.pem` trên CI runner, thì đôi khi câu trả lời đáng buồn là: không cần hack gì phức tạp, chỉ cần “lỡ” có người copy key ra khỏi đúng chỗ.

## “HSM” không phải để làm crypto nhanh hơn

Tôi từng tưởng HSM là để tăng hiệu năng crypto. Nhưng trong bối cảnh code signing, giá trị chính của HSM là:

- Private key được sinh ra và nằm trong phần cứng.
- Private key không được “export” theo nghĩa thực dụng (không có file để copy).
- Người ký phải cắm thiết bị + nhập PIN, tức là *có sự hiện diện*.

Nói cách khác: HSM biến “ký” từ một hàm trong code thành một hành vi có ma sát.

Ma sát này chính là thứ cứu bạn trong những ngày xui.

## Cây quyết định: vì sao chọn HSM portable (thay vì HSM to đùng)

Khi chọn HSM cho hệ thống ký firmware, tôi thấy có ít nhất 3 hướng (mỗi hướng có cái giá riêng):

1) HSM dạng appliance (đặt trong data center)
- Ưu: tập trung, kiểm soát chặt.
- Nhược: vận hành nặng; dễ trở thành “single bottleneck” cho release.

2) Cloud HSM
- Ưu: tích hợp tốt với cloud stack.
- Nhược: ràng buộc cloud; câu chuyện “ai giữ key” đôi khi khó nói.

3) HSM dạng portable cho signer
- Ưu: chia quyền ký cho nhiều người; giảm điểm chết.
- Nhược: phải quản lý phân phối, quy trình, audit.

Trong một triển khai điển hình, lựa chọn ở đây là một HSM dạng portable: nhỏ, có chứng nhận, hỗ trợ PKCS#11, đủ dùng cho ký Ed25519, và quan trọng là có thể phát cho từng signer.

## Reality check: người mua (và đội vận hành) thật sự quan tâm gì?

Nếu bỏ hết jargon, tôi thấy yêu cầu thực tế hay rơi vào 3 nhóm (và nhóm nào cũng “đúng”, chỉ khác thứ tự ưu tiên):

1) Giảm rủi ro lộ key (blast radius nhỏ)
2) Không làm release bị kẹt (velocity)
3) Có audit trail để giải trình (ai ký, ký cái gì, lúc nào)

Nhiều hệ thống ký số thất bại vì cố tối ưu nhóm (1) nhưng làm nát nhóm (2): mọi thứ phải qua một “ông admin giữ key”, đến lúc ông đó đi họp là release đứng hình.

## Nghi lễ ký 3-trên-5: nhìn giống thủ tục, nhưng là guardrail

Thiết kế 3-trên-5 (3-of-5) nghe có vẻ “corporate”, nhưng nó giải được một bài toán rất đời thường:

- Không muốn 1 người có thể tự ý phát hành firmware.
- Nhưng cũng không thể bắt đủ 5 người online cùng lúc.

Một cách nhìn đơn giản:

```text
Build Server -> Signing Server -> (signing request) -> 5 Signers
                                       |-> thu ít nhất 3 chữ ký hợp lệ
                                       v
                                    OTA/Release
```

![Signing flow](/images/posts/hsm-3-tren-5-ky-so-firmware-yubihsm2/signing-flow.svg)

![3-of-5 threshold](/images/posts/hsm-3-tren-5-ky-so-firmware-yubihsm2/multisig-3of5.svg)

Điểm hay là bạn đang chia rủi ro theo cả hai trục:

- Trục kỹ thuật: key nằm trong HSM, không rời khỏi thiết bị.
- Trục tổ chức: quyền phát hành cần đồng thuận, không phụ thuộc một người.

## Một framework 3 bước để nghĩ cho “ký firmware” (thực dụng)

Nếu phải nén mọi thứ lại để triển khai được, tôi dùng 3 bước sau:

![Key lifecycle](/images/posts/hsm-3-tren-5-ky-so-firmware-yubihsm2/key-lifecycle.svg)

1) Khóa (keys)
- Chỉ đưa private key vào nơi có kiểm soát mạnh nhất.
- Ưu tiên “không thể copy” thay vì “khó copy”.

2) Nghi lễ (ceremony)
- Ai được ký? Ký cái gì? Cửa sổ ký mở bao lâu?
- Multi-party approval (ví dụ 3-trên-5) là luật tổ chức, không phải tính năng.

3) Bằng chứng (audit)
- Log không phải để “đẹp”, mà để khi có sự cố bạn trả lời được: chuyện gì đã xảy ra.

Một mảnh ghép thường bị xem nhẹ là chuẩn giao tiếp giữa tool và HSM: PKCS#11.
Bạn không cần nhớ hết API, chỉ cần giữ một mental model kiểu “client trao đổi với HSM” như dưới đây:

```text
PKCS#11: signing client <-> HSM

Signing Client (app/tool)                     HSM (PKCS#11 token)
-----------------------------------------------------------------
1) C_Initialize()                     ->       token ready
2) C_OpenSession()                    ->       session handle
3) C_Login(PIN)                       ->       verify PIN / policy
4) C_FindObjects*()                   ->       key handle (non-exportable)
5) C_Sign(digest)                     ->       sign with private key
   digest ----------------------------->
   signature <--------------------------
6) C_Logout() + C_CloseSession()       ->       clear state
7) C_Finalize()                        ->       unload module

Key idea: digest goes in, signature comes out; private key never leaves HSM.
```

## Anti-pattern: biến private key thành một “secret bình thường”

Một số phản xạ rất tự nhiên (và rất nguy hiểm):

- Nhét private key vào CI secrets vì “tiện”.
- Cho build server quyền ký trực tiếp vì “tự động hóa”.
- Để một người vừa build vừa ký vì “ít người thì làm gì có separation-of-duties”.

Những thứ này đều có chung một bệnh: nó làm giảm ma sát đến mức kẻ tấn công chỉ cần chiếm một hệ thống (CI/build) là có quyền phát hành.

HSM không làm bạn miễn nhiễm. Nó chỉ giúp bạn buộc hệ thống phải trả lời câu hỏi: “Key đang ở đâu, ai đang chạm vào nó?”

## Kết

Tôi thích nhìn HSM như một cách “định hình hành vi” hơn là một món đồ crypto.

Khi bạn thiết kế ký firmware với HSM + 3-trên-5, bạn đang nói thẳng một nguyên tắc:

- Quyền phát hành không thuộc về một script.
- Nó thuộc về một quy trình có người chịu trách nhiệm, có đồng thuận, và có dấu vết.

Và nếu phải nhớ một câu để mang sang dự án khác: *đừng tối ưu sự tiện cho người ký đến mức quên mất sự an toàn cho người dùng.*

## Định nghĩa nhanh (để khỏi lạc)

| Thuật ngữ | Nghĩa trong bài này |
|---|---|
| OTA | Over-The-Air: kênh phát hành/cập nhật firmware từ server xuống thiết bị qua mạng. |
| HSM (Hardware Security Module) | Thiết bị phần cứng giữ private key và thực hiện thao tác ký; private key không rời khỏi thiết bị. |
| Code signing | Ký số lên firmware để thiết bị kiểm tra “ai phát hành” và “có bị sửa không”. |
| Signer | Người được cấp quyền ký (mỗi người giữ 1 HSM). |
| Signing ceremony | Quy trình/“nghi lễ” tổ chức việc ký: ai ký, ký cái gì, trong cửa sổ thời gian nào, audit ra sao. |
| 3-of-5 | Cần ít nhất 3 chữ ký hợp lệ trong 5 signer để phát hành. |
| Digest | Giá trị băm (ví dụ SHA-256) đại diện cho nội dung image; thường ký trên digest thay vì ký cả file. |
| Ed25519 | Thuật toán chữ ký (ECC) cho chữ ký 64 bytes, nhanh và gọn cho firmware. |
| PKCS#11 | Chuẩn API để app nói chuyện với HSM (open session, login, sign...). |
| mTLS | Mutual TLS: client và server đều xác thực lẫn nhau bằng certificate khi kết nối. |
| Signing request (trong bài này) | Yêu cầu ký (payload + metadata). Tránh nhầm với Certificate Signing Request. |
