import { attendancePresentation } from "@/lib/services/attendance-presentation";

type RosterPreviewPerson = {
  id: string;
  name: string;
  phone: string | null;
  attendanceStatus: string;
  attendanceState: string;
  firstClass: boolean;
};

export function RosterPreview({
  eventName,
  eventId,
  people,
  canViewPhone,
}: {
  eventName: string;
  eventId: string;
  people: RosterPreviewPerson[];
  canViewPhone: boolean;
}) {
  return (
    <section className="admin-roster-preview" aria-labelledby="manage-event-roster-preview-title">
      <div className="admin-roster-preview-heading">
        <div>
          <p className="admin-roster-preview-kicker">Roster preview · {people.length} registered</p>
          <h3 id="manage-event-roster-preview-title">{eventName}</h3>
        </div>
        <span>
          {people.filter((person) => person.attendanceStatus === "ATTENDED").length} checked in
        </span>
        <a
          className="ops-invitation-submit admin-roster-download"
          href={`/admin/events/${eventId}/roster.csv`}
        >
          Download roster <span aria-hidden="true">↓</span>
        </a>
      </div>
      <ol className="admin-roster-preview-list" aria-label="Roster preview participants">
        {people.slice(0, 4).map((person) => (
          <li key={person.id}>
            <span>
              <strong>{person.name}</strong>
              {canViewPhone && person.phone ? <small>{person.phone}</small> : null}
            </span>
            <span className={person.attendanceStatus === "ATTENDED" ? "is-checked-in" : ""}>
              {attendancePresentation(person.attendanceStatus, person.attendanceState).label}
            </span>
          </li>
        ))}
      </ol>
      {!people.length ? (
        <p className="admin-roster-preview-empty">No participants registered.</p>
      ) : null}
      {people.length > 4 ? (
        <p className="admin-roster-preview-more">+ {people.length - 4} more participants</p>
      ) : null}
    </section>
  );
}
