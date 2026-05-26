// lib/gtmClient.js – client-safe helpers (no Node/server imports)

// Columns: Event Name | Variable Name | Variable Type | Scope | Description | Tag Type | Measurement ID
export function parseDataLayerDoc(rows) {
  const events = {};
  rows.forEach((row) => {
    const [eventName, varName, varType, scope, desc, tagType, measurementId] =
      row.map((c) => String(c || "").trim());
    if (!eventName || eventName.toLowerCase() === "event name") return;

    if (!events[eventName]) {
      events[eventName] = {
        eventName,
        variables: [],
        // Tag config — read from first row that has these values
        tagType: "",
        measurementId: "",
        sendEcommerce: false,
      };
    }

    // Pick up tag config from any row in the group that has it
    if (tagType && !events[eventName].tagType)       events[eventName].tagType = tagType.toLowerCase();
    if (measurementId && !events[eventName].measurementId) events[eventName].measurementId = measurementId;

    if (varName) {
      events[eventName].variables.push({
        varName, varType: varType || "dataLayer", scope: scope || "hit", desc,
      });
    }
  });

  const result = Object.values(events);

  // Auto-detect ecommerce events by name pattern
  const ecommerceEvents = ["purchase", "add_to_cart", "remove_from_cart", "view_item",
    "view_item_list", "begin_checkout", "add_payment_info", "add_shipping_info",
    "view_cart", "refund"];

  result.forEach((evt) => {
    if (ecommerceEvents.some((e) => evt.eventName.toLowerCase().includes(e))) {
      evt.sendEcommerce = true;
    }
  });

  return result;
}