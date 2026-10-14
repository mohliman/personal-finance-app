import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Icon, PageHeading } from "./components";
import { FinanceModal, type ModalState } from "./Modal";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Pots from "./pages/Pots";
import RecurringBills from "./pages/RecurringBills";
import { useFinance } from "./store";
import s from "./App.module.css";
import { AccountBar } from "./AccountBar";

const navigation = [
  ["/", "Overview", "nav-overview"],
  ["/transactions", "Transactions", "nav-transactions"],
  ["/budgets", "Budgets", "nav-budgets"],
  ["/pots", "Pots", "nav-pots"],
  ["/recurring-bills", "Recurring Bills", "nav-recurring-bills"],
];
export default function App() {
  const [minimized, setMinimized] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [message, setMessage] = useState("");
  const { storageWarning } = useFinance();
  const location = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = `Frontend Mentor | Personal finance app — ${navigation.find(([path]) => path === location.pathname)?.[1] ?? "Page not found"}`;
    if (!firstRender.current) {
      document.getElementById("page-title")?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    firstRender.current = false;
  }, [location.pathname]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div className={`${s.app} ${minimized ? s.minimized : ""}`}>
      <a className={s.skipLink} href="#main">
        Skip to content
      </a>
      <aside className={s.sidebar}>
        <NavLink to="/" className={s.brand} aria-label="Finance home">
          <img
            src={`/assets/images/logo-${minimized ? "small" : "large"}.svg`}
            alt="finance"
          />
        </NavLink>
        <nav aria-label="Main navigation">
          {navigation.map(([path, label, icon]) => (
            <NavLink
              key={path}
              end={path === "/"}
              to={path}
              className={({ isActive }) =>
                `${s.navItem} ${isActive ? s.activeNav : ""}`
              }
              title={minimized ? label : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className={s.minimize}
          onClick={() => setMinimized((value) => !value)}
          aria-label={minimized ? "Expand menu" : "Minimize menu"}
          aria-expanded={!minimized}
        >
          <Icon name="minimize-menu" className={minimized ? s.flipped : ""} />
          <span>Minimize Menu</span>
        </button>
      </aside>
      <main className={s.main} id="main" tabIndex={-1}>
        <AccountBar />
        {storageWarning && (
          <p className={s.storageWarning} role="alert">
            {storageWarning}
          </p>
        )}
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets openModal={setModal} />} />
          <Route path="/pots" element={<Pots openModal={setModal} />} />
          <Route path="/recurring-bills" element={<RecurringBills />} />
          <Route
            path="*"
            element={
              <>
                <PageHeading title="Page not found" />
                <p>Use the navigation to return to your finances.</p>
              </>
            }
          />
        </Routes>
      </main>
      <div
        role="status"
        aria-live="polite"
        className={message ? s.toast : s.srOnly}
      >
        {message}
      </div>
      {modal && (
        <FinanceModal
          modal={modal}
          onClose={() => setModal(null)}
          onSuccess={(text) => {
            setMessage(text);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
