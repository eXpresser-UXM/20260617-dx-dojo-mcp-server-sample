import express from "express";
import { getServer } from "./mcp-server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";

const app = express();
app.use(express.json()); // body-parserが必須
const server = getServer();

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({});
  res.on("close", () => {
    transport.close();
  });
  await server.connect(transport as any);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.error(`MCP Streamable HTTP Server running on port ${PORT}...`);
});
