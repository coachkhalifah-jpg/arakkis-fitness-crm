import Link from "next/link";

const individualOptions = [
  ["WORTH_NOTICING", "Worth Noticing"],
  ["CELEBRATE", "Celebrate"],
  ["TOUCH_BASE", "Touch Base"],
] as const;

const groupOptions = [
  ["BEFORE_CLASS", "Before Class"],
  ["AFTER_CLASS", "After Class"],
  ["CHALLENGES", "Challenges"],
  ["TIPS", "Tips"],
  ["POLLS", "Polls"],
  ["LOGISTICS", "Logistics"],
] as const;

type Props = {
  mode: "individual" | "group";
  selected: string;
  status: string;
};

export function CommunityShowNav({ mode, selected, status }: Props) {
  const options = mode === "individual" ? individualOptions : groupOptions;

  return (
    <div className="community-show-filter">
      <span>Show</span>
      <nav className="community-show-options" aria-label={`${mode} Community view`}>
        {options.map(([value, label]) => (
          <Link
            key={value}
            scroll={false}
            href={
              mode === "group"
                ? `/admin/community?mode=group&status=${status}&filter=${value}`
                : `/admin/community?status=${status}&filter=${value}`
            }
            aria-current={selected === value ? "page" : undefined}
            data-selected={selected === value}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
