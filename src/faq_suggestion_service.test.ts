import { chooseFaqs, parseFaqRequest } from "./faq_suggestion_service.ts";

const request = parseFaqRequest({ query: "return my order", orderUpdate: true });
const result = chooseFaqs(request, ["order-return", "fulfillment-delivery"]);
if (result.length !== 1 || result[0].id !== "order-return") {
  throw new Error("The order-update filter must select the return FAQ first.");
}
console.log("FAQ decision test passed: order-return is the suggestion for an order return query.");
