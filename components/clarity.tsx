import Script from "next/script";

// Microsoft Clarity (spec: stage 1). Loads only when NEXT_PUBLIC_CLARITY_ID is
// set, only in production builds, and never on localhost. Inputs holding API
// keys or passwords carry data-clarity-mask="true" so they are not recorded.
export function Clarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (process.env.NODE_ENV !== "production" || !id) return null;
  // The id is inlined into a script, so accept only the plain id format.
  if (!/^[a-z0-9]{6,20}$/i.test(id)) return null;

  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
if(/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(l.location.hostname))return;
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script",${JSON.stringify(id)});`}
    </Script>
  );
}
