import { Router } from "express";
import openapiSpec from "../../../openapi.json";

const router = Router();

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Developer Assessment API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        persistAuthorization: true,
        docExpansion: "list",
        filter: true,
      });
    };
  </script>
</body>
</html>`;

router.get("/", (_req, res) => {
  res.type("html").send(SWAGGER_HTML);
});

router.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});

export default router;
