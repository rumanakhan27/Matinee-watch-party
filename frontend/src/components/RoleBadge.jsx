export default function RoleBadge({ role }) {
  return <span className={`badge ${role}`}>{role}</span>;
}