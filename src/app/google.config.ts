// Configuration of the optional Google export (Google Docs and Sheets).
// Forks set their own values here, see the README section "Google-Export".

// OAuth client id of the Google Cloud project. A browser client id is public
// by design (every visitor receives it); access is limited by the project's
// OAuth consent screen (internal, atra.consulting accounts only).
export const GOOGLE_CLIENT_ID = '119770992768-4mlusrt4spfq8ium9p7m96qnttocu1bv.apps.googleusercontent.com';

// Google Docs template that the export copies into the user's Drive before it
// inserts the reference text. Points to atra.consulting's template.
export const GOOGLE_DOCS_TEMPLATE_ID = '1PiJBLqhPpo31cIYaO3iUu0sl5BsHmv32JNaoAfmmPsI';
