# Pilot payment assessment

Payments are not implemented, and no Stripe account, dependency, route, migration, or payment UI is
introduced by the pilot refinement.

## Option A — External Stripe Payment Link

This is the smallest pilot experiment: place an owner-created payment link beside an event's manual
registration instructions. Reconciliation remains manual, payment status is not authoritative in the
CRM, and capacity can diverge from paid seats. Cancellations and refunds require manual review, and
the participant must be warned that payment does not itself confirm a CRM registration.

## Option B — Integrated Stripe Checkout

This requires a pricing model, pending-payment registration state, temporary seat holds, Checkout
Sessions, signed webhook verification, idempotent payment confirmation, abandoned/failed checkout
handling, refunds, event-cancellation behavior, payment-status administration, migrations, tests,
legal/tax review, and operational monitoring. It is a substantial vertical slice rather than a UI
addition.

## Recommendation

Do not add payments to the current no-cost pilot. Validate event demand and attendance behavior first.
If payment becomes necessary, begin with a written pricing/refund policy and an external-link pilot;
move to integrated Checkout only when capacity correctness, webhook operations, refunds, and tax/legal
ownership are explicitly approved.
