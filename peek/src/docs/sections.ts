export interface DocSection {
  id: string;
  title: string;
  image?: string;
  body: string[];
}

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

const sections: DocSection[] = [
  {
    id: "about",
    title: "About Elastic Peek",
    image: logoUrl,
    body: [
      "Elastic Peek is part of an AI Software Engineering Factory proof of concept built on elastic/ai-github-actions. AI-powered workflows autonomously triage issues, review pull requests, and iterate on this codebase.",
      "The app itself is a lightweight, browser-based Elasticsearch dashboard builder created entirely by AI agents.",
      "There is no backend server — your browser talks to Elasticsearch via the _query REST API. Credentials never leave your machine.",
      "You can also run a local proxy to avoid configuring CORS on your cluster.",
    ],
  },
  {
    id: "connecting",
    title: "Connecting to Elasticsearch",
    body: [
      "Click the connection chip or gear icon in the header to open connection settings.",
      "Enter your Elasticsearch URL and choose API Key or Username/Password authentication.",
      "Your URL is saved in localStorage for convenience. Credentials are stored in sessionStorage and cleared when you close the tab.",
      "The app remembers one connection in localStorage so you do not have to re-enter the URL each time.",
    ],
  },
  {
    id: "cors",
    title: "CORS Configuration",
    body: [
      "Since the app queries Elasticsearch directly from your browser, your cluster must allow cross-origin requests.",
      "Add http.cors.enabled: true and set http.cors.allow-origin to your dashboard URL in elasticsearch.yml.",
      'For local development you can use allow-origin: "*", but never use the wildcard in production.',
      "Alternatively, use proxy mode to skip CORS entirely — see the Proxy Mode section below.",
    ],
  },
  {
    id: "proxy-mode",
    title: "Proxy Mode",
    body: [
      "Proxy mode routes all /_query requests through a local server so your browser never makes cross-origin calls.",
      "Start the dev server with: ES_URL=http://localhost:9200 make serve-proxy",
      "Then enter http://localhost:3000 as the Elasticsearch URL in the connection dialog.",
      "The Docker image also includes a built-in nginx proxy — just set the ES_URL environment variable when running the container.",
    ],
  },
  {
    id: "dashboard-workflow",
    title: "Building Dashboards",
    body: [
      "Click Add Panel to create a new visualization. Each panel has its own ES|QL query and chart type.",
      "Drag panels to rearrange them and resize by pulling the bottom-right corner.",
      "Click a panel title to open the editor where you can change the query, visualization type, and chart options.",
      "Use the time picker and refresh interval controls in the header to control the query time range.",
      "Export your dashboard as a JSON file from the overflow menu, and import it on another machine.",
    ],
  },
  {
    id: "discover-workflow",
    title: "Discover",
    body: [
      "Switch to the Discover tab to run ad-hoc ES|QL queries and explore results in a table.",
      "Use the field list on the left to select which columns are shown.",
      "Filter columns by name using the search box above the field list.",
      "When you find a useful query, click Create Panel to promote it directly into a dashboard panel.",
      "Click Export CSV to download the currently visible columns as a CSV file (discover-results.csv). Results are sanitized to prevent formula injection when opened in spreadsheet software.",
    ],
  },
  {
    id: "visualizations",
    title: "Visualization Types",
    body: [
      "Time Series — line charts for data with a date column. Supports smoothing, area fill, and stacking.",
      "Bar Chart — vertical or horizontal bars. Supports stacking.",
      "Pie Chart — proportional slices from a categorical breakdown.",
      "Stat — a single large number, ideal for KPIs and counters.",
      "Gauge — a value shown on a radial gauge with configurable min/max range.",
      "Table — raw tabular output, useful for detailed inspection of query results.",
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Tips & Shortcuts",
    body: [
      "Press Ctrl/Cmd+Enter in Discover or Panel Editor to run the current ES|QL query without leaving the keyboard.",
      "Click the dashboard title in the header to rename it inline.",
      "Use the theme toggle (sun/moon icon) to switch between light and dark mode.",
      "The Disconnect button in the connection dialog drops the active connection.",
      "Reset All State in the overflow menu wipes everything — connection and dashboards — back to defaults.",
    ],
  },
];

export default sections;
