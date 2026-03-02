# Add Data Philosophy

This document defines the canonical flow architecture for the Add Data experience. It serves as the design authority for any implementation of guided data onboarding.

## Principles

- Every step must have a single, clear purpose.
- Auto-detect and pre-fill wherever possible to reduce manual input.
- Show the user's actual data, not demo data.
- Surface contextual next steps, not generic suggestions.
- Treat Infrastructure-as-Code paths (Helm, Terraform) as first-class alternatives, not hidden links.

## Flow Architecture

The Add Data experience follows five sequential steps. Each step has a defined purpose, design intent, and key decisions.

### Step 1: What Are You Monitoring?

**Purpose:** Identify the user's technology and use case.

**Design:** A visual catalog of technology tiles organized by category (Cloud, Containers, Databases, Applications, Operating Systems, Network). A prominent search bar sits at the top. A "Recommended for you" section surfaces suggestions based on existing data or account profile.

**Key decisions:**

- Use a hybrid taxonomy: technology-first as the primary axis, with signal type and use case as secondary filters.
- Surface the 6–8 most common starting points as hero cards for new users. Place the full catalog below.

### Step 2: Select Your Environment

**Purpose:** Narrow the install path based on deployment context.

**Design:** Present contextual choices based on the technology selected in Step 1. For Kubernetes: which distribution (EKS, GKE, AKS, vanilla)? For a host: which OS? For a cloud provider: which account or region?

**Key decisions:**

- Auto-detect the environment where possible. If the user is in a cloud environment, infer the provider.
- Skip this step for technologies that have a single install path.

### Step 3: Install and Configure

**Purpose:** Get the agent, collector, or integration running.

**Design:** Generate copy-paste-ready commands for the user's specific environment. Provide tabs for different methods (shell script, Helm, Terraform, Docker Compose, manual). Pre-fill commands with account-specific tokens and endpoints.

**Key decisions:**

- The primary path should be a one-liner or short script that handles everything.
- Offer IaC alternatives (Helm values, Terraform modules) as equal-priority tabs.
- Show what each command does in plain language before the user runs it.

### Step 4: Validate Data Receipt

**Purpose:** Confirm that data is flowing and the setup is correct.

**Design:** A real-time polling UI with a clear status indicator. Show specific signals being received (e.g., "Receiving CPU metrics from 3 hosts" rather than just "Data received"). Provide inline troubleshooting for common failure modes.

**Key decisions:**

- Timeout gracefully. If no data arrives after 2 minutes, shift to active troubleshooting.
- Show partial success (e.g., "We see metrics but not logs — check your log path configuration").

### Step 5: Explore Your Data and Next Steps

**Purpose:** Deliver the first meaningful insight and build momentum for deeper adoption.

**Design:** Route directly to a pre-built, auto-populated dashboard or exploration view showing the user's actual data. Surface 2–3 contextual next-step suggestions (add another source, create an alert, invite a teammate).

**Key decisions:**

- The dashboard must show real data from the user's environment, not sample or demo data.
- Next steps must be contextual. They should reflect what the user just set up and what natural complements exist.
