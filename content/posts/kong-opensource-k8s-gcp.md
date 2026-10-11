---
title: "Architecture and Best Practices: Running Kong Open Source as an API Gateway on GKE"
date: 2026-01-19T10:00:00+07:00
draft: false
author: "Free Peak"
tags: ["Kong", "Kubernetes", "GCP", "API Gateway", "Ingress", "DevOps"]
categories: ["Architecture", "DevOps"]
description: "A deep dive into the architecture and best practices for deploying Kong Open Source as an API gateway and ingress controller on Google Kubernetes Engine (GKE)."
summary: "Why choose Kong over the default GCP Ingress? Architecture, the reasoning behind the choice, and real-world best practices for running Kong Open Source on GKE efficiently, securely and cost-effectively."
cover:
    image: "/images/kong-blog/cover.svg"
    alt: "Kong API Gateway Architecture on GKE"
---

Trong hệ sinh thái Cloud Native ngày nay, việc quản lý traffic đi vào (Ingress) và giao tiếp giữa các services (East-West) là bài toán cốt lõi. Đối với các hệ thống chạy trên Google Kubernetes Engine (GKE), mặc dù GCP cung cấp Ingress Controller mặc định (GCE Ingress), nhưng nhiều đội ngũ kỹ thuật vẫn lựa chọn **Kong Open Source**.

Bài viết này sẽ đi sâu vào lý do tại sao Kong lại là lựa chọn ưu việt về mặt kiến trúc, đồng thời chia sẻ các **Best Practices** đúc kết từ thực tế để triển khai Kong hiệu quả trên GKE.

## 1. Introduction: Kong Gateway in the K8s-on-GCP picture

Kong Open Source là một API Gateway phổ biến nhất thế giới, được xây dựng dựa trên NGINX và mở rộng bằng Lua (hoặc Go/Rust qua WASM). Trong môi trường Kubernetes, Kong đóng vai trò kép:
1.  **Ingress Controller:** Điều hướng traffic từ bên ngoài vào cluster tuân theo chuẩn Kubernetes Ingress resource.
2.  **API Gateway:** Thực hiện các chức năng nâng cao như Authentication, Rate Limiting, Logging, Transformation, v.v.

Khác với các Load Balancer layer 4 đơn thuần, Kong hoạt động ở Layer 7, cho phép xử lý logic nghiệp vụ phức tạp ngay tại "cửa ngõ" của hệ thống.

![Kong Architecture](/images/kong-blog/section1-intro.svg)

### Its role in the GKE architecture
Trên GKE, Kong thường đứng sau Google Cloud Load Balancer. Mô hình phổ biến là:
`Client` -> `GCP L4 Load Balancer` -> `Kong Proxy Service` -> `K8s Services`

Mô hình này tận dụng được sức mạnh hạ tầng mạng toàn cầu của Google (Global Load Balancing) đồng thời giữ được sự linh hoạt trong xử lý logic của Kong.

## 2. Why choose Kong over the default GCP Ingress?

GCP cung cấp GCE Ingress Controller tích hợp sẵn rất tốt, nhưng nó thường chỉ giải quyết được bài toán routing cơ bản. Khi hệ thống lớn dần, các hạn chế bắt đầu lộ diện. Dưới đây là lý do các kiến trúc sư phần mềm chuyển sang Kong:

### The weaknesses of GCP Ingress (GCE)
*   **Hạn chế về tính năng:** Chủ yếu tập trung vào L7 Load Balancing cơ bản (Path-based routing). Các tính năng như rate limiting, authentication, request transformation gần như không có hoặc rất khó cấu hình.
*   **Độ trễ (Latency):** Với các rule phức tạp, độ trễ có thể tăng lên.
*   **Vendor Lock-in:** Cấu hình phụ thuộc chặt chẽ vào Annotation của Google Cloud. Khó mang sang AWS hay Azure nếu cần chiến lược Multi-cloud.

### Kong's standout advantages
1.  **Hệ sinh thái Plugin khổng lồ:** Đây là "vũ khí bí mật" của Kong. Bạn cần Rate Limiting? Có plugin. Cần OAuth2/JWT Auth? Có plugin. Cần log request ra Kafka/ELK? Có plugin. Tất cả chỉ cần bật/tắt qua config.
2.  **Hiệu năng cao:** Kong được build trên NGINX và sử dụng OpenResty (Lua JIT), cho phép xử lý hàng chục nghìn request/giây với độ trễ cực thấp (< 10ms).
3.  **Unified Gateway:** Kong có thể xử lý cả traffic từ ngoài vào (North-South) và traffic giữa các service (East-West) trong mô hình Service Mesh (Kong Mesh).
4.  **Vendor Agnostic:** Cấu hình Kong là chuẩn Kubernetes CRD hoặc YAML. Bạn có thể bê nguyên bộ config này chạy trên AWS EKS, Azure AKS hay On-premise mà không cần sửa đổi nhiều.

![Kong vs GCP Ingress Comparison](/images/kong-blog/section2-comparison.svg)

### When should you use Kong?
*   Khi bạn cần các tính năng API Management nâng cao (Auth, Quota, Monetization).
*   Khi hệ thống có lượng traffic lớn và yêu cầu độ trễ thấp.
*   Khi bạn muốn đồng nhất công nghệ Gateway trên nhiều môi trường (Hybrid Cloud).

## 3. Best Practices: Running Kong on GKE

Để vận hành Kong ổn định trên môi trường Production, đừng chỉ dừng lại ở `helm install`. Dưới đây là các thực tiễn tốt nhất bạn nên áp dụng.

### a. Preparation and overall architecture

**1. Luôn sử dụng Helm Charts**
Không nên cài đặt Kong bằng các file YAML rời rạc (manifests). Hãy sử dụng [Official Kong Helm Chart](https://github.com/Kong/charts). Helm giúp bạn dễ dàng quản lý version, rollback khi có sự cố và tùy biến `values.yaml` một cách có cấu trúc.

**2. Tách biệt Namespace**
Đừng cài Kong vào `default` namespace. Hãy tạo một namespace riêng biệt, ví dụ `kong-gateway` hoặc `ingress-controller`. Điều này giúp quản lý Resource Quota và RBAC (phân quyền) tốt hơn, tránh việc một developer vô tình xóa nhầm Ingress Controller.

**3. Kiến trúc Load Balancing**
Trên GKE, hãy cấu hình Service của Kong Proxy là `LoadBalancer`. Google sẽ tự động cấp phát một External IP và một L4 Load Balancer trỏ vào các Pod Kong.
*   **Tip:** Sử dụng Annotation `cloud.google.com/load-balancer-type: "External"` để chỉ định rõ loại LB.

![Kong Deployment Architecture](/images/kong-blog/section3a-architecture.svg)

### b. Config and plugin management done right

**1. "Configuration as Code" với CRDs**
Kong cung cấp các Custom Resource Definitions (CRDs) như `KongPlugin`, `KongIngress`, `KongConsumer`. Hãy sử dụng chúng thay vì gọi Admin API bằng tay.
*   **Lợi ích:** Toàn bộ cấu hình được lưu trong Git, có thể review và audit (GitOps).

**2. Scope của Plugin**
Hạn chế dùng Global Plugin (áp dụng cho toàn bộ cluster) trừ khi thực sự cần thiết (ví dụ: Log correlation ID). Hãy apply plugin ở mức `Ingress` hoặc `Service` cụ thể.
Ví dụ: Service Payment cần Rate Limit khắt khe hơn Service Product Catalog.

**3. Centralized Logging**
Đừng để log "chết" trong pod. Hãy sử dụng plugin `tcp-log`, `udp-log` hoặc `file-log` để đẩy log về hệ thống giám sát tập trung. Trên GCP, bạn có thể đẩy thẳng về **Google Cloud Logging (Stackdriver)**.

![Configuration Flow](/images/kong-blog/section3b-config-flow.svg)

### c. Optimisation and security

**1. Bảo vệ Kong Admin API**
Đây là nguyên tắc sống còn. Kong Admin API (mặc định port 8001/8444) cho phép thay đổi toàn bộ cấu hình Gateway.
*   **Action:** Chỉ expose Admin API qua `ClusterIP` (nội bộ cluster). Nếu cần truy cập từ ngoài, hãy dùng `kubectl port-forward` hoặc bảo vệ nó bằng một Ingress riêng có Authentication cực mạnh.

**2. Quản lý Secrets**
Không bao giờ hardcode API Key hay Certificate trong file cấu hình.
*   Dùng **Kubernetes Secrets** để lưu SSL Certificate.
*   Tích hợp **GCP Secret Manager** với External Secrets Operator để sync secret vào K8s an toàn.

**3. HTTPS Everywhere**
Sử dụng **Cert-Manager** kết hợp với Let's Encrypt để tự động hóa việc cấp phát và gia hạn SSL Certificate cho tất cả các domain. Cấu hình Kong để force redirect HTTP sang HTTPS.

![Security Best Practices](/images/kong-blog/section3c-security.svg)

### d. CI/CD and DevOps automation

Để đạt được sự linh hoạt tối đa, hãy áp dụng mô hình GitOps:
*   **Source Code:** Chứa code ứng dụng và file `values.yaml` cho Helm Chart của ứng dụng.
*   **Infrastructure Repo:** Chứa cấu hình Kong (Plugins, Consumers, Global Configs).
*   **CD Tool (ArgoCD/Flux):** Tự động đồng bộ trạng thái từ Git vào Cluster. Khi bạn commit một file `KongPlugin` mới lên Git, ArgoCD sẽ tự động apply nó vào K8s.

![CI/CD Pipeline](/images/kong-blog/section3d-cicd.svg)

---

## 4. Real production lessons

Trong quá trình vận hành Kong trên GKE cho các hệ thống lớn, đây là những "chiến trường" mà chúng tôi đã đi qua:

1.  **DB-less Mode không phải lúc nào cũng là “best practice”:**
    DB-less có thể rất phù hợp với GitOps và triển khai bất biến (immutable deployments), nhưng nếu cấu hình không đúng (không có fallback `declarative_config`, không persist LMDB cache, chỉ chạy 1 replica), bạn có thể gặp rủi ro mất cấu hình sau sự cố hoặc khi pod restart. Hãy chọn mode theo nhu cầu (GitOps vs runtime changes vs enterprise scale), không nên mặc định “DB-less là chân ái” cho mọi bài toán.

2.  **Cẩn thận với Health Checks:**
    Cấu hình Liveness và Readiness Probe cho Kong rất quan trọng. Nếu cấu hình sai, K8s sẽ restart Kong liên tục khi traffic tăng đột biến (do Kong xử lý chậm lại), gây ra thảm họa dây chuyền.

3.  **Plugin Ordering:**
    Thứ tự chạy của các Plugin rất quan trọng (ví dụ: Rate Limit phải chạy *trước* hay *sau* Auth?). Hãy nắm vững "Priority" của từng plugin để tránh các lỗ hổng logic.

### Best practices by use case (DB-less / PostgreSQL / Hybrid)

Dưới đây là khung tham chiếu để chọn và vận hành Kong an toàn trong Production. Mục tiêu là: nêu rõ trade-off, giảm rủi ro mất cấu hình, và phù hợp cách deploy của team.

#### 1) DB-less Mode (suits GitOps / simple setups)

`kong.conf` essentials:

```conf
database = off
declarative_config = /kong-config/kong.yaml  # ALWAYS set a fallback
lmdb_map_size = 2048m  # tune based on config size
```

Gợi ý vận hành:

*   Lưu declarative config trong Git: version control cho `kong.yaml` (review/audit/rollback).
*   Luôn set `declarative_config`: làm “phao cứu sinh” nếu LMDB cache bị mất.
*   Persist LMDB bằng PersistentVolume: giúp survive pod restarts (đặc biệt khi bạn muốn khởi động ổn định, hạn chế phụ thuộc cache tạm).
*   Validate trước khi deploy: `kong config parse kong.yaml` hoặc `deck gateway validate`.
*   Chạy nhiều replica: không phụ thuộc 1 node duy nhất.

Ví dụ Kubernetes (persist LMDB + mount declarative config):

```yaml
volumes:
  - name: kong-cache
    persistentVolumeClaim:
      claimName: kong-lmdb-pvc  # Persist dbless.lmdb
  - name: kong-config
    configMap:
      name: kong-declarative-config  # Fallback config
```

#### 2) PostgreSQL Mode (suits enterprise / runtime changes via API or UI)

*   HA PostgreSQL: Patroni, CrunchyData, hoặc managed service.
*   Read replicas (nếu cần): dùng read-only endpoint/host (tùy theo version/feature set) để offload reads.
*   Connection pooler: PgBouncer khi có nhiều Kong nodes.
*   Backup định kỳ + PITR (point-in-time recovery).
*   Tune cache: `db_update_frequency`, `db_cache_ttl` (cần test theo traffic thực tế).

#### 3) Hybrid Mode (best of both)

*   Control Plane (có DB) + Data Planes (DB-less):
    *   CP quản lý config tập trung (PostgreSQL).
    *   DPs nhẹ, cache config từ CP.
    *   DPs có thể tiếp tục chạy khi CP outage nhờ LMDB cache local (tùy cách deploy).

#### Decision framework

| Nếu bạn cần... | Nên dùng |
| --- | --- |
| GitOps, immutable deployments | DB-less |
| Thay đổi config runtime qua API/UI | PostgreSQL |
| Large scale, enterprise features | PostgreSQL hoac Hybrid |
| Minimal ops overhead | DB-less |
| Cluster-wide rate limiting (phụ thuộc DB) | PostgreSQL |
| Vừa muốn central control vừa muốn nodes nhẹ | Hybrid |

#### TL;DR

*   DB-less an toàn nếu cấu hình đúng: persist LMDB + set `declarative_config` fallback + nhiều replicas.
*   Nếu thiếu các safeguard này: đúng, cấu hình có thể bị mất sau crash/restart.
*   Production lớn: ưu tiên Hybrid, hoặc PostgreSQL nếu cần runtime changes và các nhu cầu enterprise.

![Lessons Learned](/images/kong-blog/section4-lessons.svg)

## 5. Conclusion

Sử dụng Kong Open Source trên GKE mang lại sức mạnh kiểm soát traffic tuyệt vời mà Ingress mặc định khó so sánh được. Tuy nhiên, "sức mạnh lớn đi kèm trách nhiệm lớn". Việc làm chủ Kong đòi hỏi team của bạn phải hiểu sâu về cách Kong hoạt động cũng như các mô hình quản lý cấu hình hiện đại như GitOps.

**Tóm lại:**
*   Chọn Kong nếu bạn cần **Flexibility** và **Plugins**.
*   Chọn GCP Ingress nếu bạn cần sự **Đơn giản** và **Ít vận hành**.

Hy vọng bài viết này giúp bạn có cái nhìn rõ ràng hơn cho kiến trúc hệ thống sắp tới của mình. Happy Coding!

_Tham khảo:_
*   [Kong Official Documentation](https://docs.konghq.com/)
*   [Kong Ingress Controller for Kubernetes](https://github.com/Kong/kubernetes-ingress-controller)

![Conclusion Checklist](/images/kong-blog/section5-conclusion.svg)
