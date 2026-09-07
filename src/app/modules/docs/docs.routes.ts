import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import openapiSpec from "../../../openapi.json";

const router = Router();

router.use("/", swaggerUi.serve);
router.get(
  "/",
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: "Developer Assessment API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
    },
  }),
);

router.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});

export default router;
