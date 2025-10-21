import { useEffect, useState } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function detectMobile() {
      // ✅ Use type assertion so TS doesn't complain
      const nav = navigator as Navigator & {
        userAgentData?: { mobile?: boolean; getHighEntropyValues?: any };
      };

      if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === "function") {
        nav.userAgentData
          .getHighEntropyValues(["mobile"])
          .then((ua: { mobile?: boolean }) => {
            setIsMobile(!!ua.mobile);
          })
          .catch(() => {
            // fallback if UAData fails
            fallbackUA();
          });
      } else {
        fallbackUA();
      }
    }

    function fallbackUA() {
      const ua = navigator.userAgent.toLowerCase();
      const isTouchDevice = /android|iphone|ipad|ipod|windows phone|blackberry|mobile/i.test(ua);
      setIsMobile(isTouchDevice);
    }

    detectMobile();
  }, []);

  return isMobile;
}
