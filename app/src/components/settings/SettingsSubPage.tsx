import type { ReactNode } from 'react';

export const SettingsSubPage = ({ title, onBack, children }: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) => (
  <div className="page-scroll">
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <button className="btn btn-ghost" onClick={onBack}>← Indietro</button>
        <h2 className="font-semibold flex-1 text-center">{title}</h2>
      </div>
      {children}
    </div>
  </div>
);
