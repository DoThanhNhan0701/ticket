import { useIsMobile } from "@/hooks/use-is-mobile";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MobilePageActionContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (element: HTMLDivElement | null) => void;
} | null>(null);

export function MobilePageActionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <MobilePageActionContext.Provider value={{ target, setTarget }}>
      {children}
    </MobilePageActionContext.Provider>
  );
}

export function MobilePageActionSlot() {
  const context = useContext(MobilePageActionContext);
  if (!context) return null;
  return (
    <div
      ref={context.setTarget}
      className="flex h-11 shrink-0 items-center gap-2 empty:hidden sm:hidden [&_[data-slot=button]]:size-11 [&_[data-slot=button]]:p-0 [&_svg]:size-4"
    />
  );
}

export function MobilePageAction({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(MobilePageActionContext);
  return context?.target ? createPortal(children, context.target) : children;
}

export function ResponsivePageAction({
  children,
}: Readonly<{ children: ReactNode }>) {
  const mobile = useIsMobile();
  return mobile ? <MobilePageAction>{children}</MobilePageAction> : children;
}
