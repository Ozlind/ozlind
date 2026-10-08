import { ChevronRight } from "lucide-react";

/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

export function AccountRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
  onClick,
}) {
  return (
    <button
      type="button"
      className="account-row"
      onClick={onClick}
    >
      <span className="account-row-icon">
        {Icon ? (
          <Icon
            size={20}
            strokeWidth={1.8}
          />
        ) : null}
      </span>

      <span className="account-row-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </span>

      {trailing || (
        <ChevronRight
          size={18}
          className="account-row-chevron"
        />
      )}
    </button>
  );
}

export function AccountGroup({ title, children }) {
  return (
    <section className="account-group">
      <h2>{title}</h2>
      <div className="account-group-card">
        {children}
      </div>
    </section>
  );
}

export function Switch({ checked }) {
  return (
    <span
      className={`account-switch ${
        checked ? "active" : ""
      }`}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

