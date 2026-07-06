import { useState } from "react";
import { motion } from "motion/react";
import { COMPANIES } from "@evalio/shared";
import type { IconType } from "react-icons";
import {
  FaStripe,
  FaAmazon,
  FaGoogle,
  FaMicrosoft,
  FaApple,
  FaUber,
  FaAirbnb,
  FaBolt,
} from "react-icons/fa";
import {
  SiMeta,
  SiNetflix,
  SiDatadog,
  SiGoldmansachs,
  SiPalantir,
  SiFigma,
  SiNotion,
  SiOpenai,
  SiNvidia,
  SiSalesforce,
  SiSnowflake,
  SiCloudflare,
  SiSpotify,
  SiShopify,
  SiAccenture,
  SiWalmart,
  SiFord,
  SiTesla,
  SiSiemens,
  SiTcs,
} from "react-icons/si";
import { BiLogoAdobe } from "react-icons/bi";
import {
  McKinseyLogo,
  BcgLogo,
  BainLogo,
  EyLogo,
  PwcLogo,
  KpmgLogo,
  CapgeminiLogo,
  JpmorganLogo,
  MorganStanleyLogo,
  BlackrockLogo,
  JohnsonJohnsonLogo,
  PgLogo,
  CitadelLogo,
  JaneStreetLogo,
  TwoSigmaLogo,
  HrtLogo,
  DrwLogo,
  JumpTradingLogo,
  VirtuFinancialLogo,
  ImcTradingLogo,
  DeloitteLogo,
} from "./company-logos";

interface CompanyGridProps {
  selectedCompanyId: string | null;
  onSelect: (companyId: string | null) => void;
  category?: string | null;
}

const ITEMS_PER_PAGE = 12;

const customLogos: Record<
  string,
  (props: { size: number }) => React.ReactNode
> = {
  mckinsey: McKinseyLogo,
  bcg: BcgLogo,
  bain: BainLogo,
  ey: EyLogo,
  pwc: PwcLogo,
  kpmg: KpmgLogo,
  capgemini: CapgeminiLogo,
  jpmorgan: JpmorganLogo,
  "morgan-stanley": MorganStanleyLogo,
  blackrock: BlackrockLogo,
  "johnson-johnson": JohnsonJohnsonLogo,
  pg: PgLogo,
  citadel: CitadelLogo,
  "jane-street": JaneStreetLogo,
  "two-sigma": TwoSigmaLogo,
  hrt: HrtLogo,
  drw: DrwLogo,
  "jump-trading": JumpTradingLogo,
  "virtu-financial": VirtuFinancialLogo,
  "imc-trading": ImcTradingLogo,
  "deloitte-usi": DeloitteLogo,
};

const companyIcons: Record<string, IconType> = {
  stripe: FaStripe,
  amazon: FaAmazon,
  google: FaGoogle,
  meta: SiMeta,
  netflix: SiNetflix,
  microsoft: FaMicrosoft,
  apple: FaApple,
  uber: FaUber,
  airbnb: FaAirbnb,
  datadog: SiDatadog,
  "goldman-sachs": SiGoldmansachs,
  palantir: SiPalantir,
  figma: SiFigma,
  notion: SiNotion,
  startup: FaBolt,
  openai: SiOpenai,
  nvidia: SiNvidia,
  salesforce: SiSalesforce,
  snowflake: SiSnowflake,
  cloudflare: SiCloudflare,
  spotify: SiSpotify,
  shopify: SiShopify,
  accenture: SiAccenture,
  walmart: SiWalmart,
  ford: SiFord,
  tesla: SiTesla,
  siemens: SiSiemens,
  tcs: SiTcs,
  adobe: BiLogoAdobe,
};

export function CompanyGrid({
  selectedCompanyId,
  onSelect,
  category,
}: CompanyGridProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const filtered = category
    ? COMPANIES.filter((c) => c.roles.some((r) => r.category === category))
    : COMPANIES;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages - 1);
  const sliced = filtered.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE,
  );

  if (filtered.length === 0) {
    return (
      <div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-muted)",
            textAlign: "center",
            padding: "32px 0",
          }}
        >
          No companies found for this category.
        </p>
        <CustomCompanyButton
          selectedCompanyId={selectedCompanyId}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "10px",
        }}
      >
        {sliced.map((company, i) => {
          const active = selectedCompanyId === company.id;
          return (
            <motion.button
              key={company.id}
              onClick={() => onSelect(active ? null : company.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: i * 0.02,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "20px 12px",
                borderRadius: "12px",
                border: active
                  ? "1.5px solid var(--app-accent, #b8a88a)"
                  : "1px solid var(--color-border-light)",
                background: active
                  ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                  : "transparent",
                cursor: "pointer",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor =
                    "var(--app-accent, #b8a88a)";
                  e.currentTarget.style.background =
                    "var(--app-accent-bg, rgba(184,168,138,0.04))";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-light)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {(() => {
                const IconComp = companyIcons[company.id];
                const CustomLogo = customLogos[company.id];
                if (IconComp) {
                  return (
                    <IconComp
                      size={22}
                      color={
                        active
                          ? "var(--app-accent, #b8a88a)"
                          : "var(--color-text-secondary)"
                      }
                    />
                  );
                }
                if (CustomLogo) {
                  return <CustomLogo size={22} />;
                }
                return (
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      lineHeight: 1,
                      color: active
                        ? "var(--app-accent, #b8a88a)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {company.name[0]}
                  </span>
                );
              })()}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: active
                    ? "var(--color-text)"
                    : "var(--color-text-secondary)",
                  textAlign: "center",
                  lineHeight: 1.2,
                  transition: "color 0.15s",
                }}
              >
                {company.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Pagination
          totalPages={totalPages}
          currentPage={page}
          onPageChange={setCurrentPage}
        />
      )}

      <CustomCompanyButton
        selectedCompanyId={selectedCompanyId}
        onSelect={onSelect}
      />
    </div>
  );
}

function Pagination({
  totalPages,
  currentPage,
  onPageChange,
}: {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: "6px",
    marginTop: "16px",
    flexWrap: "wrap",
  };

  const btnBase: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "1px solid var(--color-border-light)",
    background: "transparent",
    color: "var(--color-text-secondary)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  };

  const pages: (number | "...")[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (totalPages <= 7) {
      pages.push(i);
    } else {
      if (
        i === 0 ||
        i === totalPages - 1 ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
  }

  return (
    <div style={containerStyle}>
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            style={{ ...btnBase, border: "none", cursor: "default" }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              borderColor:
                p === currentPage
                  ? "var(--app-accent, #b8a88a)"
                  : "var(--color-border-light)",
              background:
                p === currentPage
                  ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
                  : "transparent",
              color:
                p === currentPage
                  ? "var(--app-accent, #b8a88a)"
                  : "var(--color-text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (p !== currentPage) {
                e.currentTarget.style.borderColor =
                  "var(--app-accent, #b8a88a)";
                e.currentTarget.style.color = "var(--app-accent, #b8a88a)";
              }
            }}
            onMouseLeave={(e) => {
              if (p !== currentPage) {
                e.currentTarget.style.borderColor = "var(--color-border-light)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }
            }}
          >
            {p + 1}
          </button>
        ),
      )}
    </div>
  );
}

function CustomCompanyButton({
  selectedCompanyId,
  onSelect,
}: {
  selectedCompanyId: string | null;
  onSelect: (companyId: string | null) => void;
}) {
  return (
    <motion.button
      onClick={() => onSelect("__custom__")}
      whileHover={{
        scale: 1.02,
        borderColor: "var(--app-accent, #b8a88a)",
        color: "var(--app-accent, #b8a88a)",
      }}
      whileTap={{ scale: 0.99 }}
      onMouseEnter={(e) => {
        if (selectedCompanyId !== "__custom__") {
          e.currentTarget.style.borderColor = "var(--app-accent, #b8a88a)";
          e.currentTarget.style.background =
            "var(--app-accent-bg, rgba(184,168,138,0.04))";
        }
      }}
      onMouseLeave={(e) => {
        if (selectedCompanyId !== "__custom__") {
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.background = "transparent";
        }
      }}
      style={{
        marginTop: "16px",
        padding: "12px 20px",
        borderRadius: "10px",
        border:
          selectedCompanyId === "__custom__"
            ? "1.5px solid var(--app-accent, #b8a88a)"
            : "1px dashed var(--color-border)",
        background:
          selectedCompanyId === "__custom__"
            ? "var(--app-accent-bg, rgba(184,168,138,0.06))"
            : "transparent",
        color: "var(--color-text-secondary)",
        fontSize: "13px",
        cursor: "pointer",
        width: "100%",
        transition: "all 0.15s",
      }}
    >
      {selectedCompanyId === "__custom__"
        ? "✓ Custom company selected"
        : "+ Custom company (not in list)"}
    </motion.button>
  );
}
