import express from "express";
import { listOrdersForCustomer } from "./api/orders.js";

const app = express();
app.get("/customers/:customerId/orders", listOrdersForCustomer);

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: "info", event: "server_started", port }));
  });
}

export { app };
