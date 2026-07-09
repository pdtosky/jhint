window.APP_CONFIG = {
  backend: "supabase",
  requireGlobalLogin: true,
  authRedirectUrl: "https://jhint.vercel.app/",
  supabaseUrl: "https://fftdjnjnvusgrbbfbwcw.supabase.co",
  supabaseAnonKey: "sb_publishable_gh-Sk00ag9txoBF5Y5u5sQ_ybAY3jL-",
  supabaseTable: "app_state",
  supabaseRowId: "main",
  adminEmails: ["tape@jhint.net"],
  requisitionEmails: [],
  pollIntervalMs: 60000,
  weekendPollIntervalMs: 300000,
  holidayPollIntervalMs: 300000,
  // 공휴일이나 회사 휴무일은 "YYYY-MM-DD" 형식으로 추가하세요.
  holidayDates: []
};
