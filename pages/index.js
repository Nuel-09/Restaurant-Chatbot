import { useEffect, useState } from "react";

function genDeviceId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("device_id", id);
  }
  return id;
}

export default function Home() {
  const [deviceId, setDeviceId] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Welcome! 🍕\nSend:\n1 - Place an order\n99 - Checkout\n98 - Order history\n97 - Current order\n0 - Cancel order",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectingItem, setSelectingItem] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  useEffect(() => {
    const id = genDeviceId();
    setDeviceId(id);
  }, []);

  async function send(inputVal, options = {}) {
    if (!deviceId) return;
    setMessages((prev) => [...prev, { from: "user", text: inputVal }]);

    const body = { deviceId, input: inputVal };
    if (selectingItem && options.tempSelections) {
      body.tempSelections = { selectingItem };
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    setMessages((prev) => [
      ...prev,
      { from: "bot", text: json.message || JSON.stringify(json) },
    ]);

    if (json.selectingItem) {
      setSelectingItem(json.selectingItem);
    } else {
      setSelectingItem(null);
    }

    if (json.authorization_url) {
      setTimeout(() => {
        window.open(json.authorization_url, "_blank");
      }, 500);
    }
  }

  function handleScheduleClick() {
    if (!scheduleTime) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Please select a time first" },
      ]);
      return;
    }
    send(`schedule:${scheduleTime}`, { tempSelections: true });
    setShowSchedule(false);
    setScheduleTime("");
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "#333", fontSize: 24 }}>
          🍕 Restaurant Chatbot
        </h1>
        <p
          style={{
            margin: "4px 0 0 0",
            color: "#666",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Device ID: {deviceId?.slice(-8) || "loading..."}
        </p>
      </div>

      {/* Messages Container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: m.from === "bot" ? "flex-start" : "flex-end",
              animation: "fadeIn 0.3s ease-in",
            }}
          >
            <div
              style={{
                background: m.from === "bot" ? "#fff" : "#667eea",
                color: m.from === "bot" ? "#333" : "#fff",
                padding: "12px 16px",
                borderRadius:
                  m.from === "bot" ? "0 12px 12px 12px" : "12px 0 12px 12px",
                maxWidth: "85%",
                wordWrap: "break-word",
                whiteSpace: "pre-wrap",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                lineHeight: 1.5,
                fontSize: 14,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div
        style={{
          background: "#fff",
          padding: 16,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Schedule Input */}
        {showSchedule && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "#f0f4ff",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                fontSize: 14,
              }}
            />
            <button
              onClick={handleScheduleClick}
              style={{
                background: "#667eea",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Schedule
            </button>
            <button
              onClick={() => setShowSchedule(false)}
              style={{
                background: "#e5e7eb",
                color: "#333",
                border: "none",
                padding: "8px 12px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Text Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && input.trim()) {
                send(input, { tempSelections: !!selectingItem });
                setInput("");
              }
            }}
            placeholder={
              selectingItem
                ? "Select an option (e.g., s, m, l)"
                : "Type number or command"
            }
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => {
              send(input, { tempSelections: !!selectingItem });
              setInput("");
            }}
            style={{
              background: "#667eea",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              transition: "0.2s",
            }}
            onMouseOver={(e) => (e.target.style.background = "#5568d3")}
            onMouseOut={(e) => (e.target.style.background = "#667eea")}
          >
            Send
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <button
            onClick={() => send("1")}
            style={{
              padding: "10px 12px",
              background: "#f0f4ff",
              color: "#667eea",
              border: "1px solid #667eea",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              transition: "0.2s",
            }}
            onMouseOver={(e) => {
              e.target.style.background = "#667eea";
              e.target.style.color = "#fff";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "#f0f4ff";
              e.target.style.color = "#667eea";
            }}
          >
            📋 Order
          </button>
          <button
            onClick={() => send("97")}
            style={{
              padding: "10px 12px",
              background: "#f0f4ff",
              color: "#667eea",
              border: "1px solid #667eea",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseOver={(e) => {
              e.target.style.background = "#667eea";
              e.target.style.color = "#fff";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "#f0f4ff";
              e.target.style.color = "#667eea";
            }}
          >
            🛒 Current
          </button>
          <button
            onClick={() => send("98")}
            style={{
              padding: "10px 12px",
              background: "#f0f4ff",
              color: "#667eea",
              border: "1px solid #667eea",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseOver={(e) => {
              e.target.style.background = "#667eea";
              e.target.style.color = "#fff";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "#f0f4ff";
              e.target.style.color = "#667eea";
            }}
          >
            📜 History
          </button>
          <button
            onClick={() => send("99")}
            style={{
              padding: "10px 12px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              gridColumn: "1 / 2",
            }}
            onMouseOver={(e) => (e.target.style.background = "#059669")}
            onMouseOut={(e) => (e.target.style.background = "#10b981")}
          >
            ✅ Checkout
          </button>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            style={{
              padding: "10px 12px",
              background: "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              gridColumn: "2 / 3",
            }}
            onMouseOver={(e) => (e.target.style.background = "#d97706")}
            onMouseOut={(e) => (e.target.style.background = "#f59e0b")}
          >
            ⏰ Schedule
          </button>
          <button
            onClick={() => send("0")}
            style={{
              padding: "10px 12px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              gridColumn: "3 / 4",
            }}
            onMouseOver={(e) => (e.target.style.background = "#dc2626")}
            onMouseOut={(e) => (e.target.style.background = "#ef4444")}
          >
            ❌ Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        input:focus {
          outline: none !important;
          border: 2px solid #667eea !important;
        }
      `}</style>
    </div>
  );
}
