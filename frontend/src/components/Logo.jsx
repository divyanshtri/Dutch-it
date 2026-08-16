// Logo.jsx
function Logo({ className = '', onClick }) {
  return (
    <span 
      className={`app-header__logo ${className}`} 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }} // adds pointer cursor when clickable
    >
      Dutch<span className="accent-dash">-</span>it
    </span>
  );
}

export default Logo;