import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import sirv from "sirv";

const serve = sirv(fileURLToPath(new URL("./dist/", import.meta.url)), {
  single: true,
  setHeaders(response, pathname) {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Cache-Control", pathname.endsWith(".html") ? "no-cache" : "public, max-age=3600");
  },
});
const port = Number(process.env.PORT || 4173);
createServer(serve).listen(port, "0.0.0.0", () => {
  console.log(`Garda Jakarta FE listening on port ${port}`);
});
