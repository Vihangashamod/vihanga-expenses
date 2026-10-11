import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "./data/store";
import { UIProvider } from "./data/ui";
import { Shell } from "./components/Shell";
import Overview from "./pages/Overview";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Accounts from "./pages/Accounts";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import Import from "./pages/Import";

function Gate() {
  const { status } = useStore();
  if (status === "loading") return <div className="loading" aria-label="Loading"><div className="spinner" /></div>;
  if (status === "signed-out") return <SignIn />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Overview />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="insights" element={<Insights />} />
        <Route path="settings" element={<Settings />} />
        <Route path="import" element={<Import />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <UIProvider>
          <Gate />
        </UIProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}
