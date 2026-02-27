import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.BFF_PORT ?? "3000");
  await app.listen(port, "0.0.0.0");
  Logger.log(`bff-service listening on ${port}`, "Bootstrap");
}

void bootstrap();
