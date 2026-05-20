const baseUrl =
  process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function run() {
  const deviceId = `smoke_${Date.now()}`;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, input: "1" }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Chat smoke test failed: ${JSON.stringify(data)}`);
  }

  if (!data.message || !data.message.includes("Menu:")) {
    throw new Error("Chat smoke test did not return menu text");
  }

  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await healthRes.json();
  if (!healthRes.ok || health.status !== "ok") {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }

  console.log("Smoke test passed");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
