---
title: "xdev: cách tôi viết một agent coding CLI nhẹ và nhanh"
date: 2026-09-16T14:01:03+07:00
draft: false
author: "Free Peak"
tags: ["ai", "coding", "golang", "tui", "developer-tools", "agent"]
categories: ["Technology", "AI"]
description: "7 ngày viết lại coding agent harness bằng Go: 1 binary 20MB, RSS nền ~16MB, 4 tool lõi, system prompt dưới 1000 token. Kể chuyện thật: số đo thật, bug thật, và thứ tôi cố tình không làm."
summary: "Tôi dùng omp, opencode, Claude Code mỗi ngày và ngày càng khó chịu với độ nặng của chúng. Bài này kể lại 7 ngày viết xdev: đọc kiến trúc pi/omp, port data model sang Go, vật lộn với terminal UI, và những con số đo được trên máy tôi — 20MB binary, ~16MB RAM, 40ms khởi động."
ShowToc: true
TocOpen: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowShareButtons: true
ShowCodeCopyButtons: true
cover:
    image: ""
    alt: "xdev terminal UI"
    caption: ""
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/FreePeak/Labs/tree/main/content"
    Text: "Suggest Changes"
    appendFilePath: true
---

> **Lưu ý trước khi đọc:** mọi con số trong bài là tôi đo trên máy cá nhân (macOS, Apple Silicon) vào ngày 16/09/2026, bằng lệnh tôi ghi rõ. Máy bạn sẽ khác. Tôi không so sánh chất lượng agent — chỉ so sánh độ nặng.

## 1) Mở đầu bằng một câu hỏi ngớ ngẩn

Chiều hôm đó tôi mở 3 tab terminal: một tab chạy omp, một tab Claude Code, một tab opencode. Ba cái đều đang "nghĩ".

Tôi bật `htop`.

Tôi ngồi nhìn cái bảng màu và tự hỏi một câu rất ngớ ngẩn: **một công cụ để viết code thì cần những gì nằm trong bộ nhớ?**

Không phải terminal app. Không phải trình soạn thảo. Một vòng lặp: gửi text lên model, nhận text về, gọi tool, lặp lại.

Tôi trả lời được câu đó, và sau khi trả lời thì không chịu nổi nữa. Nên tôi viết xdev. 7 ngày, 403 commit.

Bài này kể lại 7 ngày đó: tôi đọc gì, quyết định gì, sai chỗ nào, và đo được gì.

## 2) Cân đo đong đếm trước đã

Tôi không viết bài này để bảo các tool kia tệ. omp và Claude Code là hai thứ tôi dùng hằng ngày, và nếu không có chúng thì tôi không bao giờ nghĩ tới chuyện tự viết.

Vấn đề của chúng với tôi không nằm ở tính năng. Nằm ở **cái giá của tính năng**.

Đây là số đo trên máy tôi:

| Tool | Binary | `--version` (TB 5 lần) | Data dir |
|---|---|---|---|
| xdev | 20 MB | 0.040 s | 144 MB |
| omp | 186 MB | 0.091 s | 5.7 GB |
| Claude Code | 210 MB | 0.060 s | 1.1 GB |
| opencode | 144 MB | 0.358 s | 155 MB |

Lệnh đo binary: `ls -lL ~/.local/bin/xdev`. Lệnh đo thời gian: vòng lặp 5 lần gọi `--version`, cộng thời gian bằng `time.time()`. `hyperfine` thì tôi không có, nên số của tôi thô — nhưng đủ để thấy khoảng cách.

Cột "binary" đáng nói nhất. omp, Claude Code, opencode đều là **binary Mach-O thật**, không phải script. Nhưng `strings` vào cả ba thì ra cùng một họ hàng: `bun-v1.4.2`, `bun-v1.4.3`, `bun-v1.3.14`. Cái bạn tải về không phải chương trình của họ — nó là chương trình của họ **cộng với** cả một runtime JS bị nhét vào trong.

20MB với ~200MB, ở cùng một việc. Đây không phải so sánh "ai code giỏi hơn ai"; Go hay TS không phải lý do. Lý do là **bạn có cần cái runtime đó trong binary của bạn không**, khi công việc của nó phần lớn là chờ network.

## 3) Đi học trước khi viết: pi và omp

Tôi không tự nghĩ ra thiết kế. Tôi ngồi đọc, và đọc xong thì thấy mình không cần thông minh nữa.

**pi** (github.com/earendil-works/pi) là một coding agent harness bằng TypeScript của Mario Zechner, và nó là cái khiến tôi đổi cách nghĩ. Triết lý của nó gói trong vài dòng mà tôi đọc xong phải ngồi im:

- **System prompt dưới 1000 token**, tính luôn cả mô tả tool. Lý do: model frontier đã được RL-train để hiểu coding agent. Nhét 10.000 token hướng dẫn vào là mang nặng.
- **Đúng 4 tool lõi**: `read`, `write`, `edit`, `bash`. Bốn cái đó là đủ.
- **YOLO mặc định.** Không có sân khấu xin quyền. Vì combo *đọc dữ liệu + chạy code + gọi mạng* thì không cách nào nhốt bằng prompt hay bằng rule pattern được. Muốn nhốt thì nhốt bằng container hoặc micro-VM, đừng nhốt bằng lời nhắn.
- **Không có todo tool built-in.** Model bị confuse bởi state mà tool quản lý. Muốn list việc thì viết ra `TODO.md`.
- **Tự tay viết tầng LLM**, không dùng SDK. Vì thế giới chỉ có **4 wire API** đáng kể: OpenAI Completions, OpenAI Responses, Anthropic Messages, Google GenAI.

**omp (Oh My Pi)** là fork của pi, và nó là thứ tôi dùng hằng ngày. omp thêm đủ thứ hữu ích: tầng Rust N-API cho grep/glob/AST/PTY, filesystem-scan cache dùng chung, extension system trong process, MCP, subagent hub, compaction với 6 đường trigger, session tree rất kỷ luật.

Cái giá: runtime JS làm nền, extension nạp **trong cùng process**, event queue không chặn biên, và **cả session nằm trong memory**. Trên máy tôi `~/.omp` phình ra 5.7 GB.

Và đây là quyết định quan trọng nhất của cả 7 ngày, tóm trong một câu:

> **Port data model. Đừng port code.**

JSONL session tree (append-only + một con trỏ lá), unified stream contract, cách dựng lại context, compaction, OutputSink, frame-plan TUI — tất cả đều là thiết kế đã được hiện trường tôi dẫm vào vài tháng. Chúng đúng. Việc của tôi là chép **ngữ nghĩa** (tên entry giữ nguyên để tooling cũ còn đọc được), không phải chép implementation của thời JS.

Nghiên cứu tôi viết ra trong 7 ngày nằm ở `docs/research/`: 19 file phân tích omp, pi, Claude Code, opencode, hermes, fx — kèm bảng verdict từng tính năng: cái nào port, cái nào bỏ, cái nào port khác đi và **tại sao**. `docs/parity-delta.md` ghi lại mọi chỗ tôi cố tình khác omp, và cả những flag omp tôi **nhận cho tương thích nhưng không có nghĩa** (như `--no-pty`, vì bash của tôi là pipe-based).

## 4) Kiến trúc: những gì tôi chọn, và những gì tôi cố tình không làm

Module path `github.com/FreePeak/xdev`, Go 1.25, **CGO-free**, một binary tĩnh, đúng 5 direct dependency (`tcell`, `go-runewidth`, MCP Go SDK, `yaml.v3`, `modernc.org/sqlite`).

### Session là cây JSONL append-only, với một con trỏ lá

Không có entry nào bị sửa hay xoá. Branch chỉ là **dời một con trỏ**. Context dựng lại bằng cách đi theo parent link. Format inspectable — bạn `jq` vào file session của tôi được, và tôi không cần viewer riêng.

Đây là port ngữ nghĩa từ pi/omp, và nó là thứ khiến tôi yên tâm nhất trong thiết kế. Vì nó cho phép một thứ mà harness dạng "state trong memory" không cho: **nhìn lại và cãi nhau với quá khứ**.

### Mọi thứ đều có biên

Queue có biên. Buffer có biên. Session window có biên. Output sink có biên.

Cụ thể: `debug.SetMemoryLimit(100MB)` (override bằng `XDEV_MEMLIMIT`), và khi live heap chạm **85%** ngưỡng đó thì agent **buộc compaction**, không đợi tới ngưỡng token.

Ý nghĩa thực dụng: một turn mất kiểm soát degrade thành "compact ngay", không thành OOM kill. Backpressure là feature, không phải bug.

Tôi đo lúc boot: ~16MB RSS. 30–70MB ước tính cho phiên làm việc bình thường, worst case ép dưới 100MB. Đây là chỗ duy nhất tôi tự tin vào số mình chưa đo đủ: **tôi chưa chạy một phiên 200k token thật sự tới đáy.** Con số 100MB là thiết kế + các test có thật, không phải là measurement của tình huống tệ nhất.

### 4 tool lõi, và phần còn lại là tuỳ chọn

Prompt + 4 tool nằm dưới 1000 token, và chỗ này tôi không tin lời mình — tôi **test cái giới hạn đó**:

```go
// cmd/xdev/prompt_test.go
const maxPromptTokens = 1000

if tokens := len([]rune(got)) / 4; tokens >= maxPromptTokens {
    t.Fatalf("system prompt is ~%d tokens (budget %d): %d chars across %d tools"+
        " — trim a description or make a deliberate PRD change", ...)
}
```

Ước token bằng `rune / 4` là thô. Tôi biết. Nhưng nó là một **cái cổng**, không phải cái thước — mục đích của nó là bắt tôi phải sửa PRD một cách có ý thức mỗi khi muốn phình prompt, thay để phình im lặng.

`grep`, `glob`, `lsp`, `eval`, `browser`, `debug`, `computer`, `tts`, `task`... đều có, nhưng chúng là lớp thêm vào sau khi 4 cái lõi đã đứng. Tổng: 544 file Go, ~90k dòng không tính test, ~63k dòng test — tức **test chiếm 41% codebase**.

### Những thứ tôi cố tình không làm

Nói rõ cái mình không làm quan trọng hơn nói cái mình làm:

- **Không permission theater.** Không có popup "xdev muốn chạy `ls`?". YOLO mặc định, và harness chỉ *tài liệu hoá* pattern sandbox (`docs/reference/container-and-sandbox.md`), không dựng tường giấy.
- **Không PTY trong tool bash.** Pipe-based. Cờ `--no-pty` của omp tôi nhận cho tương thích script và nó... no-op có chủ đích, ghi rõ trong parity-delta.
- **Không nạp extension trong process.** Extension chạy **subprocess** nói chuyện bằng JSONL handshake. Một extension crash không được phép làm chết agent. Cái mất: renderer custom trong process — extension chỉ **khai báo** spec (`card` | `table` | `tree`), host render, và spec sai thì degrade về plain text.
- **Không tự nhận là bản sao.** omp v18.1.17 có 131 trang docs `omp://`; tôi diff cơ học `omp --help` vs `xdev -h` và ghi lại từng thứ thiếu, kèm lý do.

## 5) TUI: chỗ tôi mất nhiều thời gian nhất

Đây là phần tôi muốn kể nhất, vì nó là chỗ tôi sai nhiều nhất.

### tcell, không phải bubbletea

bubbletea đẹp, dễ, tài liệu tốt. Nhưng mô hình Elm của nó **allocate nhiều**, và trong một cái TUI mà mỗi giây nhận cả nghìn token stream thì allocation churn chính là giật.

tcell thô hơn, nhanh hơn, ít cấp phát hơn — và frame-plan model của omp port lên nó sạch. Đổi lại bạn phải tự quản mọi thứ. Tôi tự quản mọi thứ.

### Frame plan: ba trạng thái của một block

Mỗi frame là: chrome bắt buộc (editor/status/HUD/overlay) + `TerminalFramePlan { history?: {id, rows}, viewport: rows[] }`.

Và transcript block có **ba trạng thái**:

| Trạng thái | Nghĩa | Xử lý khi resize |
|---|---|---|
| **active** | còn thay đổi được, nằm trong viewport | vẽ lại |
| **settled** | đã chốt, **reflow được** | reflow, cho tới khi áp lực dung lượng |
| **committed** | đã đẩy vào terminal scrollback thật | không còn là việc của mình |

Cái insight làm tôi vỡ ra vì **tổn hiệu suất**: bạn phải vẽ *viewport*, không vẽ *session*. Commit `perf(tui): draw the viewport, not the session; trim aged tool output first` là commit tôi ước mình viết được từ ngày đầu.

### Resize là thứ đáng ghét nhất trong terminal

Alt-screen (`?1049h`) chỉ cho overlay, còn transcript thì dòng nào cuộn mất khỏi màn hình tôi đẩy vào **scrollback thật của terminal**. Lý do rất đơn giản: khi tôi không còn nhìn thấy nó, không có lý do gì nó chiếm RAM của tôi.

Hậu quả: khi terminal resize, con trỏ của tôi không còn ở chỗ tôi nghĩ. Phải hỏi lại terminal mình đang ở dòng nào bằng DSR anchor rồi dựng lại. `DSR-anchor resize recovery` nằm trong PRD từ đầu, và nó là một trong những dòng chữ gây đau khổ nhất tôi từng viết.

### Bốn cái bug TUI tôi nhớ mãi

**Bug 1 — đóng băng thật sự.** `fix(tui): the tree selector could own the keyboard while painting nothing — a "frozen TUI" with a live process`. Một selector vẽ ra **không gì cả** nhưng vẫn **nắm bàn phím**. Người dùng thấy treo, process vẫn sống. Ghê ở chỗ: mọi tín hiệu "process còn sống" của tôi đều nói ổn.

**Bug 2 — self-deadlock.** `fix(tui): picker draw must not re-lock a.mu — self-deadlock hung every draw with content`. Vẽ lại khoá lại cái lock đã có. Treo **mọi** frame có nội dung.

**Bug 3 — modal không vẽ được thì phải đóng.** `fix(tui): a modal that cannot paint must close, and cancel hits the turn`. Tôi từng để modal ở lại khi nó không paint được. Đúng ra: không vẽ được thì biến mất. Một modal bạn không thấy mà vẫn nhận phím là một cái bẫy.

**Bug 4 — scroll hint đè lên nội dung.** `fix(tui): the scroll hint was painted over the first transcript row`. Nhỏ. Nhưng bạn thấy nó ngay lần đầu mở tool.

Sau 3 bug đầu, tôi thêm watchdog: **UI loop iteration nào quá 5 giây thì dump goroutine stack** ra `~/.xdev/agent/dumps/` (giới hạn dump 1MB).

Lý do: 3 vụ treo tôi vừa kể, nếu không có dump thì tôi chỉ còn cách đoán. Và đoán một cái TUI treo là lãng phí thời gian. Tôi chấp nhận tốn một goroutine để đổi lấy việc không phải đoán nữa.

### Chuột: thứ tôi làm đi làm lại

Chuột trong TUI không có spec. Nó chỉ có cảm giác "sai". Và cảm giác sai đó tôi phải trả lời 5 lần trong 4 tiếng:

```
23:19  fix(tui): Shift hands the drag to the terminal, mid-stroke too
01:07  feat(tui): mouse selection covers the whole screen and stays visible
01:51  feat(tui): one mouse drag can select past the screen
02:19  feat(tui): the modal picker answers the mouse, like omp's SelectList
02:40  feat(tui): click-to-focus on the live-agent roster
```

Cái đầu tiên là cú đau: người dùng nhấn Shift để copy bằng selection của **chính terminal**, và tôi phải nhả con trỏ giữa thao tác kéo — kể cả khi họ đã kéo được nửa đường. Không có thiết kế nào dạy tôi chi tiết đó. Chỉ có dùng thật.

Cái cuối cùng thì buồn cười: tôi đã làm một bảng roster agent chỉ điều khiển được bằng phím. Trong terminal năm 2026.

### Chủ đề: 66 token màu

Tôi port hệ theme của Grok CLI (`GrokNight`/`GrokDay`, tự đổi theo `OSC 11`), và bắt buộc **đủ 66 color token** — spelling giống hệt omp, để một file theme của omp paint được chrome của xdev mà không phải sửa gì. Thiếu một token là test fail, không "để sau".

Cả ngày làm việc trong một cái TUI mà để nó dùng màu mặc định của terminal thì tôi chịu không nổi. Đây là chi phí tôi tự nguyện trả, và tôi nghĩ nó đáng.

## 6) Kiểm thử một thứ chỉ để hiển thị bằng chữ

Nghe buồn cười. Nhưng TUI của tôi render **chữ**, và chữ thì không ai diff bằng mắt một cách có kỷ luật được.

Nên phần lớn test TUI của tôi là test **dòng ký tự**: dựng frame trên một simulterminal, rồi so text.

- **Keymap** (10 test): mọi action phải resolve được, `ChordOf` đúng chiều, file keymap user hỏng thì về default chứ không crash, `/hotkeys` phải hiển thị **mọi** action, và remap thật sự đổi hành vi.
- **Chrome** (15 test): status row phải nói bạn đang ở đâu chứ không phải liệt kê phím; HUD meter phải hiện `used/total` của context sống; đồng hồ phiên phải re-base khi đổi session, và khi không có neo thì **ẩn đi** chứ đừng hiển thị `00:00`.
- **Composer**: `Up`/`Down` trong bản nháp nhiều dòng phải đi theo **dòng hiển thị**, không phải dòng logic — nghe hiển nhiên cho tới khi editor của bạn đụng wide character.
- **Không treo**: `draw_hang_test.go` có 5 test dựng frame trên simulterminal rồi timeout — selector không được nắm bàn phím khi vẽ ra chỗ trống, modal không paint được thì phải đóng. `tree_test.go` ghim chặt luôn vụ self-deadlock: draw không được re-lock mutex của app. Ba cái bug ở mục trên, giờ bị nhốt lại bằng code.

63k dòng test, trong đó nhiều test chỉ để nói "cái dòng này phải giống hệt hôm qua". Tốn công giữ. Nhưng mỗi lần tôi refactor renderer, chúng là thứ duy nhất cho phép tôi refactor mà không sợ.

## 7) Thứ mà model sinh ra để làm tôi bất ngờ

Trong quá trình build có một cái tôi rất thích: `an unparseable tool call is an error result, not a dead run`.

Trước đó, nếu model trả về tool call với arguments parse không được, turn **chết**. Đơn giản vậy thôi, và ngu vậy thôi.

Sau: nó là một **tool error** bay ngược lên model, và model tự sửa. Một dòng xử lý lỗi đổi thành một vòng tự chữa. Tôi không dạy model thông hơn; tôi chỉ ngừng làm nó bị cắt giữa câu.

Tương tự: `edit arg-repair + freshness guard`. Args sửa được thì sửa (model hay off-by-one ở số dòng), còn file đã đổi kể từ lúc agent đọc thì **dừng lại và bảo**, đừng ghi đè.

Cặp này là toàn bộ triết lý của tôi về harness: chỗ nào máy tự vá được thì vá, chỗ nào vá là mất dữ liệu thì dừng.

## 8) Ba thứ tôi học được

**Một: "nhẹ" không phải là cắt tính năng. Là cắt runtime.**

xdev cuối cùng cũng có subagent hub, MCP client, LSP, memory backend, collab E2E, web search, browser qua CDP, DAP debugger. 35 package trong `internal/`. Tính năng tôi không cắt. Tôi bỏ cái runtime bị nhét theo, và để các thứ nặng chạy ở **process con**.

**Hai: kỷ luật không nằm trong ý định, nó nằm trong test.**

Mọi con số tôi khoe ở đầu bài đều có thứ gì đó giữ lại. 1000 token? Có `prompt_test.go` fail nếu tôi viết dài hơn. 66 color token? Có `m12_test.go`. help phải nêu tên mọi subcommand và không được sót `@both`? Có `usage_test.go` — sinh ra sau vụ 13 subcommand biến mất khỏi help cùng lúc.

Nếu kỷ luật không có test, sau 3 ngày và 100 commit nó không còn là kỷ luật, nó là ký ức.

**Ba: đừng port code. Port **cái vì sao**.**

Chỗ nào tôi port cả implementation lẫn lý do, tôi nhanh. Chỗ nào tôi port implementation mà không ghi lý do, tôi mất nửa ngày để phát hiện ra mình vừa mang theo một quyết định của người khác.

`docs/parity-delta.md` vì thế có giá trị ngang code. Nó là nơi tôi ghi: omp làm A, tôi làm B, và **vì sao B**.

## 9) Thử nếu bạn muốn

```bash
curl -fsSL https://raw.githubusercontent.com/FreePeak/xdev/main/scripts/install.sh | sh
```

Xong thì `xdev setup` để tạo `~/.xdev/agent/`, sửa `models.yml` trỏ vào gateway bạn có, rồi:

```bash
xdev tui                       # chế độ tương tác
xdev "tìm chỗ nào trong repo này đang log ra password"
xdev --resume 01a0             # resume theo prefix session id
```

`xdev bench --turns 5 --model @smol` đo TTFT và decode p50/p95 cho provider của bạn — nếu bạn tò mò về con số của tôi.

Repo: `github.com/FreePeak/xdev` (Apache-2.0).

## 10) Chốt lại

Câu hỏi "một công cụ viết code thì cần gì trong bộ nhớ" với tôi giờ có đáp án: khoảng 16MB, 4 cái tool, và một cái session format mà `jq` đọc được.

Phần còn lại của 7 ngày là học cách **không** làm nhiều hơn thế.

Còn 200MB kia của các tool bạn đang dùng? Không phải lỗi của họ. Họ chọn rộng thay vì nhẹ, và với nhiều người thì chọn đó đúng.

Chỉ là sáng nay tôi mở 3 tab terminal "đang nghĩ", nhìn `htop`, và lần đầu tiên không thấy mình đang đốt RAM để chờ một cái model trả lời.
