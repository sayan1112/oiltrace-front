import React from "react";
import "./IncidentPanel.css";

function IncidentPanel({ incident, vessels = [] }) {
  const topCandidate = [...vessels].sort(
    (a, b) =>
      (a.candidateRank ?? 999) -
      (b.candidateRank ?? 999)
  )[0];

  const formatDetectedTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC";
  };

  return (
    <aside
      className="incident-panel"
      aria-label="Incident overview"
    >
      {/* HEADER */}
      <div className="incident-panel-header">
        <div>
          <span className="incident-kicker">
            INCIDENT
          </span>

          <h2>
            {incident.id}
          </h2>

          <div className="incident-status-row">
            <span className="incident-status">
              {incident.status}
            </span>

            <span className="incident-severity">
              {incident.severity}
            </span>
          </div>
        </div>
      </div>

      {/* INCIDENT DESCRIPTION */}
      <section className="incident-block">
        <div className="incident-description">
          {incident.spillType}
        </div>

        <div className="incident-detected">
          <span>Detected</span>

          <strong>
            {formatDetectedTime(
              incident.detectedAt
            )}
          </strong>
        </div>
      </section>

      {/* SPILL ASSESSMENT */}
      <section className="incident-section">
        <div className="incident-section-title">
          Spill Assessment
        </div>

        <div className="incident-metrics">
          <div className="incident-metric">
            <span>AREA</span>

            <strong>
              {incident.areaKm2}
              <small> km²</small>
            </strong>
          </div>

          <div className="incident-metric">
            <span>DETECTION</span>

            <strong>
              {Math.round(
                incident.detectionConfidence *
                  100
              )}
              <small>%</small>
            </strong>
          </div>

          <div className="incident-metric">
            <span>SATELLITE</span>

            <strong>
              {incident.satellite?.platform ||
                "—"}
            </strong>

            <small className="metric-subtext">
              {incident.satellite?.sensor ||
                ""}
            </small>
          </div>
        </div>
      </section>

      {/* INVESTIGATION */}
      <section className="incident-section">
        <div className="incident-section-title">
          Investigation
        </div>

        <div className="incident-investigation-card">
          <div className="incident-candidate-count">
            <span>CANDIDATES</span>

            <strong>
              {vessels.length}
            </strong>

            <small>
              potential source vessels
            </small>
          </div>

          <div className="incident-top-candidate">
            <span>TOP CANDIDATE</span>

            <strong>
              {topCandidate?.name ||
                "No candidate"}
            </strong>

            {topCandidate && (
              <div className="incident-confidence">
                <span>
                  Attribution confidence
                </span>

                <strong>
                  {Math.round(
                    topCandidate.attributionConfidence *
                      100
                  )}
                  %
                </strong>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="incident-section">
        <div className="incident-section-title">
          Investigation Timeline
        </div>

        <div className="incident-timeline">
          {incident.timeline?.map(
            (event, index) => (
              <div
                className="incident-timeline-item"
                key={`${event.time}-${index}`}
              >
                <div className="timeline-marker">
                  <span />
                </div>

                <div className="timeline-content">
                  <strong>
                    {event.time}
                  </strong>

                  <span>
                    {event.label}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* DATA STATUS */}
      <div className="incident-data-note">
        <span className="incident-data-dot" />

        <div>
          <strong>
            {incident.satellite?.productStatus ||
              "Demo reference"}
          </strong>

          <span>
            Investigation data is simulated
            for demonstration.
          </span>
        </div>
      </div>
    </aside>
  );
}

export default IncidentPanel;