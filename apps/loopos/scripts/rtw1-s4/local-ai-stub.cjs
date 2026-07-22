/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");

const port = Number(process.env.PORT ?? 3211);
const server = http.createServer((request, response) => {
  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    response.writeHead(404).end();
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    let prompt = "";
    try {
      const parsed = JSON.parse(body);
      prompt = String(parsed.messages?.map((message) => message.content).join("\n") ?? "");
    } catch {
      response.writeHead(400).end();
      return;
    }

    const content = prompt.includes("组织运行事实")
      ? JSON.stringify({
          title: "S4 组织周回顾",
          content: "本周完成战术 Action 分配与治理角色创建，所有写入均由会议参与人确认。",
          nextWeekFocus: ["跟踪 Action 闭环结果", "观察新角色是否产生下一轮张力"],
          risks: "真实团队运行摩擦仍需在试点周记录。",
        })
      : "纪要中的负责人、验收标准和下一步均明确。建议在下周回顾中核对 Action 是否闭环。";

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});

server.listen(port, "127.0.0.1", () => console.log(`Local AI stub ready at http://127.0.0.1:${port}`));
