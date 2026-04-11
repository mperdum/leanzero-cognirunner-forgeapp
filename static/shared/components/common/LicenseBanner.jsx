export const LicenseBanner = ({ licenseActive }) => {
  if (licenseActive === false) {
    return (
      <div className="license-banner license-inactive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>License inactive — AI validation is disabled. Transitions will pass through without checks.</span>
      </div>
    );
  }

  if (licenseActive === true) {
    return (
      <div className="license-banner license-active">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>License active</span>
      </div>
    );
  }

  return null;
};

export default LicenseBanner;