import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { FinanceProvider } from "./store";
import App from "./App";
import "./global.css";
import { AccountGate } from "./account/Account";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="finance-account">
        <AccountGate
          title="finance"
          description="A clearer picture of your everyday money."
        >
          <FinanceProvider>
            <App />
          </FinanceProvider>
        </AccountGate>
      </div>
    </BrowserRouter>
  </React.StrictMode>,
);
