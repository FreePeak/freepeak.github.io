---
title: "Lock In VPC CIDR Early: A Small Decision That Prevents Tearing It All Down Later"
date: 2026-01-19T10:00:00+07:00
draft: false
author: "Free Peak"
tags: ["aws", "iac", "terragrunt", "networking", "eks"]
categories: ["Architecture", "DevOps"]
description: "Why choosing a VPC CIDR early matters: real-world experience on how CIDR decisions shape AWS infrastructure growth, and how to govern CIDR effectively with Terragrunt."
summary: "A VPC CIDR looks like a small technical choice, but it is the foundation of the whole network. Here is why locking it in early and treating it as a project-level decision saves you from rebuilding when you scale."
cover:
    image: "/images/posts/chot-vpc-cidr-tu-som/cover.svg"
    alt: "VPC CIDR Planning - AWS Infrastructure Best Practice"
---

Ngày bắt đầu dựng AWS cho IaC platform, tôi tưởng network là phần “nhẹ đô”: tạo VPC, chia subnet, apply là xong.

Nhưng network có một đặc điểm rất kỳ: lúc mới làm thì nó trông như vài dòng config. Đến lúc bạn muốn mở rộng (VPN, peering, multi-account, kết nối on-prem, tách môi trường), tự nhiên mọi thứ quay lại cắn bạn.

Và thứ hay cắn nhất lại là một dòng nhìn vô hại: CIDR của VPC.


![CIDR Timeline](/images/posts/chot-vpc-cidr-tu-som/timeline.svg)
## Changing a CIDR is not like changing a variable

CIDR nhìn như một lựa chọn kỹ thuật thuần túy:

- `10.0.0.0/16`

Nhưng thực tế nó là ranh giới địa chỉ IP của cả “thành phố” hạ tầng bạn đang xây:

- subnet public/private sinh ra từ đó
- route table, NAT gateway, VPC endpoints bám theo đó
- EKS nodes, pods, services… đều phải sống trong không gian đó
- peering / VPN / Transit Gateway phải thương lượng với CIDR đó

Lúc mới dựng dev, bạn ít khi thấy vấn đề. Vẫn ping được, vẫn deploy được, vẫn lên cụm.

Rắc rối chỉ lộ ra khi bạn bắt đầu nối mạng thật: VPC-to-VPC, VPC-to-onprem, hoặc gom nhiều môi trường/tài khoản vào một hệ thống.

Tới đoạn đó, bạn mới bật ra câu hỏi: “Nếu CIDR đang dùng bị chồng lấp thì sao?”

Câu trả lời thường là: *thì mệt*.

- Bạn có thể thêm CIDR thứ hai, rồi dọn dẹp dần.
- Hoặc bạn tạo VPC mới và migrate.

Dù chọn hướng nào, đây cũng không phải loại việc bạn muốn làm vào tuần mà team đang bận release.

## Why CIDRs overlap

Tôi thấy có hai nguyên nhân phổ biến:

1) **Copy-paste kinh điển**

AWS tutorial nào cũng có ví dụ `10.0.0.0/16`. Bạn copy một lần thì không sao. Nhưng đến lúc bạn có 3 cái VPC, 5 môi trường, thêm một mạng office cũng dùng `10.0.0.0/16`… thế là bắt đầu “đụng hàng”.

2) **Không có “bảng địa chỉ” cấp tổ chức**

Mỗi team tự chọn một dải. Khi chưa kết nối liên mạng thì vẫn ổn. Khi cần nối thì phát hiện dải của nhau chồng lấp và không route được.

CIDR chồng lấp không phải lỗi kỹ thuật phức tạp. Nó giống kiểu “lúc xây nhà quên chừa đường ống”. Quên xong rồi, sửa mới đau.

## Lock the CIDR early, and lift it to project-level config

Tôi không nghĩ CIDR là thứ cần “chọn cho đúng một lần là xong mãi mãi”. Nhưng tôi tin nó là thứ nên *được quản trị như một quyết định nền tảng*, thay vì nằm rải rác trong code.

Cách tôi làm (đơn giản, nhưng hiệu quả) là:

- Khai báo `vpc_cidr` ở `project.hcl` theo từng môi trường.
- Truyền nó xuống `network/terragrunt.hcl` bằng inputs.


![Terragrunt CIDR Structure](/images/posts/chot-vpc-cidr-tu-som/terragrunt-structure.svg)
Vì sao quan trọng?

- CIDR trở thành “tham số cấp dự án”, review một phát là thấy.
- Mỗi môi trường có dải rõ ràng, ít biến thành “mystery meat config”.
- Về sau muốn thêm staging/prod/multi-account, bạn chỉ việc mở rộng bảng CIDR, tránh chồng lấp từ đầu.

Tóm lại: thay vì để CIDR là một chi tiết implementation, tôi coi nó là một phần của hợp đồng kiến trúc.

## A small strategy for a big problem

Nếu áp dụng cách nghĩ “chiến lược bắt đầu từ vấn đề”, thì vấn đề ở đây không phải là “chọn CIDR nào cho đẹp”.

Vấn đề là: *về sau bạn sẽ phải kết nối nhiều thứ lại với nhau, và lúc đó CIDR sai sẽ làm bạn trả giá cao.*

Chốt CIDR từ sớm không làm bạn deploy nhanh hơn hôm nay.

Nhưng nó giúp bạn khỏi phải chạy ngược lại vào ngày mai.

## Illustrations

- Sơ đồ 1: CIDR là nền cho mọi lớp hạ tầng

![CIDR foundation](/images/posts/chot-vpc-cidr-tu-som/cidr-foundation.svg)

- Sơ đồ 2: Khi CIDR chồng lấp, đường nối bị “kẹt”

![CIDR overlap](/images/posts/chot-vpc-cidr-tu-som/cidr-overlap.svg)
