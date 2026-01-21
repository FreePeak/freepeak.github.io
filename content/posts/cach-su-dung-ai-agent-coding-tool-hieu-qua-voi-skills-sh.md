---
title: "Cách Sử Dụng AI Agent Coding Tool Hiệu Quả Với Skills.sh"
date: 2026-01-21T10:00:00+07:00
draft: false
author: "FreePeak Labs"
tags: ["ai", "coding", "productivity", "skills-sh"]
categories: ["engineering"]
description: "Hướng dẫn thực tế để tận dụng AI agent coding tools và hệ sinh thái Skills.sh"
summary: "Từ việc cài tool hàng chục cái đến việc dùng đúng tool đúng thời điểm - một framework thực tế"
ShowToc: true
TocOpen: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowShareButtons: true
ShowCodeCopyButtons: true
cover:
    image: "images/posts/skills-sh-framework.svg"
    alt: "Skills.sh AI Coding Framework"
    caption: ""
    relative: false
    hidden: false
editPost:
    URL: "https://github.com/FreePeak/Labs/tree/main/content"
    Text: "Suggest Changes"
    appendFilePath: true
---

Gần đây tôi phải build tính năng mới. Khoảng 2-3 lần một tuần. Đôi khi gấp hơn. Càng làm càng thấy time mình tốn vào việc setup, configure, fix bug nhiều hơn là logic chính.

Tôi vốn là engineer, không phải product manager. Nhưng vì deadline, tôi phải tự làm hết. Mỗi lần như thế lại tốn khoảng 1-2 giờ chỉ để setup environment, install dependencies, chạy test.

Vấn đề quan trọng nhất là: làm sao giảm time setup xuống 15 phút mà không sacrifice quality? Nếu sai ở bước này, mọi thứ downstream đều sai - deploy chậm, bug nhiều, team không có momentum.

Trong AI coding có 2 hướng chính: autocomplete vs agent-based. Autocomplete thì nhanh như Copilot, nhưng chỉ help ở level dòng code. Agent thì mạnh hơn như Cursor, Claude Code, nhưng setup phức tạp và hay "hallucinate".

Tôi chọn agent-based vì:
- Project phức tạp cần hiểu context lớn
- Task involve nhiều file, nhiều system
- Tôi muốn delegate cả quá trình reasoning chứ không chỉ syntax

Nhưng rồi tôi nhận ra: buyer priorities thực tế của dev team khác hẳn với những gì vendor quảng cáo.

Dev team thực tế chỉ quan tâm:

1. Tăng tốc độ ship feature
2. Giảm bug và regression
3. Đừng break existing code

Trong khi các AI tool quảng cáo: "rewrite your entire codebase in minutes", "100x productivity", "zero bug". Nghe hay, nhưng thực tế thì giống như bán khóa học nâng cao cho người đang nằm liệt giường - họ cần basic trước.

Thời gian đầu tôi cứ cài hết. Copilot xong cài Cursor, Cursor xong thử Claude Code, rồi lại tìm Windsurf, Roo, Trae... Mỗi tool có setup riêng, key riêng, workflow riêng.

Sang tháng 4 năm ngoái, tôi đọc một câu trong Hacker News: "Best tool is the one you already know how to use".

Nghe có vẻ thừa. Nhưng tôi nhận ra: mình đang quá tập trung vào tool chứ không vào skill.

Skills.sh ra đời với ý tưởng: thay vì cài từng tool, bạn cài "skill" - reusable capability mà bất kỳ agent nào cũng có thể dùng. Một lệnh:

```bash
npx skills add <owner/repo>
```

Lúc này mới thấy rõ: AI agent tools thì nhiều, nhưng skills mới là thứ thực sự tăng productivity.

![Skills.sh Framework](/images/posts/skills-sh-framework.svg)

Framework của tôi khá đơn giản, chỉ 3 bước:

**Bước 1: Define task type**
- Coding: web-design-guidelines, react-best-practices
- Review: code-review, test-driven-development
- Debug: systematic-debugging
- Deploy: cicd-workflows, deployment

**Bước 2: Match với agent strengths**
- Quick fix: dùng Claude Code (CLI, fast)
- Long session: dùng Cursor (VSCode-based)
- Parallel tasks: dispatch multiple agents via skills

**Bước 3: Measure, iterate**
- Time before vs after
- Bug rate before vs after
- Team satisfaction score

Làm hiệu quả với AI coding tools là:
- Biết mình đang ở giai đoạn nào (exploration vs implementation)
- Chọn skill phù hợp với task đó
- Dùng agent như "orchestrator" chứ không phải "writer"

Anti-pattern tôi thấy nhiều:

Team setup 10+ AI tools, nhưng mỗi dev chỉ dùng 1-2 cái. Kết quả? License phí cao, adoption thấp, ROI âm.

Một ví dụ khác: dùng AI để refactor toàn bộ codebase mà không có test coverage. Nghe hợp lý, nhưng thực tế thì như sửa nhà mà không kiểm tra nền móng. Nó sẽ sập.

Framework này không chỉ áp dụng cho cá nhân, mà cho cả team, company. Level càng cao thì càng cần consistency - ai cũng phải hiểu same process, same expectation.

Cuối cùng, chiến lược dùng AI coding tools là chọn skill cần học và tool cần dùng. Biết mình đang làm gì, chọn tool phù hợp, và measure kết quả.

Đó là cách tôi giảm time setup từ 2 giờ xuống 15 phút. Không phải do tool magic, mà do mình biết cần skill gì và dùng như thế nào.

---

## Danh Sách AI Agent Coding Tools

Dưới đây là tổng hợp các AI agent coding tools hỗ trợ bởi Skills.sh:

1. **AMP** - [ampcode.com](https://ampcode.com/)
2. **Antigravity** - [antigravity.google](https://antigravity.google/)
3. **Claude Code** - [claude.com](https://claude.com/product/claude-code)
4. **ClawdBot** - [clawd.bot](https://clawd.bot/)
5. **Codex** - [openai.com](https://openai.com/codex)
6. **Cursor** - [cursor.sh](https://cursor.sh)
7. **Droid** - [factory.ai](https://factory.ai)
8. **Gemini** - [gemini.google.com](https://gemini.google.com)
9. **GitHub Copilot** - [github.com](https://github.com/features/copilot)
10. **Goose** - [block.github.io](https://block.github.io/goose)
11. **Kilo** - [kilo.ai](https://kilo.ai/)
12. **Kiro CLI** - [clawd.bot](https://clawd.bot/)
13. **OpenCode** - [opencode.ai](https://opencode.ai/)
14. **Roo** - [roocode.com](https://roocode.com/)
15. **Trae** - [trae.ai](https://www.trae.ai/)
16. **Windsurf** - [codeium.com](https://codeium.com/windsurf)

## Skills Phổ Biến Tại Skills.sh

Theo leaderboard, những skill được install nhiều nhất:

| Skill | Owner | Installs |
|-------|-------|----------|
| vercel-react-best-practices | vercel-labs/agent-skills | 22.0K |
| web-design-guidelines | vercel-labs/agent-skills | 16.8K |
| building-ui | expo/skills | 1.2K |
| upgrading-expo | expo/skills | 1.2K |
| data-fetching | expo/skills | 1.1K |
| dev-client | expo/skills | 1.0K |
| deployment | expo/skills | 975 |
| api-routes | expo/skills | 938 |
| cicd-workflows | expo/skills | 903 |
| tailwind-setup | expo/skills | 874 |
