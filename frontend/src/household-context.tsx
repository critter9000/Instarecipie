import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { storage } from "@/src/utils/storage";

type HouseholdState = {
  householdId: string | null;
  memberId: string | null;
  memberName: string | null;
  ready: boolean;
  save: (householdId: string, memberId: string, memberName: string) => Promise<void>;
  clear: () => Promise<void>;
};

const HID_KEY = "amm.householdId";
const MID_KEY = "amm.memberId";
const NAME_KEY = "amm.memberName";

const HouseholdContext = createContext<HouseholdState | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const hid = await storage.getItem<string>(HID_KEY, "");
      const mid = await storage.getItem<string>(MID_KEY, "");
      const name = await storage.getItem<string>(NAME_KEY, "");
      if (hid) setHouseholdId(hid);
      if (mid) setMemberId(mid);
      if (name) setMemberName(name);
      setReady(true);
    })();
  }, []);

  const save = async (hid: string, mid: string, name: string) => {
    await storage.setItem(HID_KEY, hid);
    await storage.setItem(MID_KEY, mid);
    await storage.setItem(NAME_KEY, name);
    setHouseholdId(hid);
    setMemberId(mid);
    setMemberName(name);
  };

  const clear = async () => {
    await storage.removeItem(HID_KEY);
    await storage.removeItem(MID_KEY);
    await storage.removeItem(NAME_KEY);
    setHouseholdId(null);
    setMemberId(null);
    setMemberName(null);
  };

  return (
    <HouseholdContext.Provider
      value={{ householdId, memberId, memberName, ready, save, clear }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHouseholdCtx() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHouseholdCtx must be used within HouseholdProvider");
  return ctx;
}
