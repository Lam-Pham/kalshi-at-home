import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEvent } from "./kalshi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchEvent", () => {
  it("uses nested outcomes when Kalshi includes an empty sibling markets array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          event: {
            event_ticker: "KXWCADVANCE-26JUL15ENGARG",
            series_ticker: "KXWCADVANCE",
            title: "England vs Argentina",
            category: "Sports",
            mutually_exclusive: true,
            markets: [
              {
                ticker: "KXWCADVANCE-26JUL15ENGARG-ENG",
                event_ticker: "KXWCADVANCE-26JUL15ENGARG",
                title: "England vs Argentina: To Advance",
                yes_sub_title: "England advances",
                yes_bid_dollars: "0.5300",
                yes_ask_dollars: "0.5400",
                no_bid_dollars: "0.4600",
                no_ask_dollars: "0.4700",
                status: "active",
                result: "",
                close_time: "2099-08-12T19:00:00Z",
                volume_24h_fp: "17515799.05",
              },
              {
                ticker: "KXWCADVANCE-26JUL15ENGARG-ARG",
                event_ticker: "KXWCADVANCE-26JUL15ENGARG",
                title: "England vs Argentina: To Advance",
                yes_sub_title: "Argentina advances",
                yes_bid_dollars: "0.4600",
                yes_ask_dollars: "0.4700",
                no_bid_dollars: "0.5300",
                no_ask_dollars: "0.5400",
                status: "active",
                result: "",
                close_time: "2099-08-12T19:00:00Z",
                volume_24h_fp: "40195790.02",
              },
            ],
          },
          markets: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event = await fetchEvent("KXWCADVANCE-26JUL15ENGARG");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(event?.title).toBe("England vs Argentina");
    expect(event?.markets.map((market) => market.yesSubTitle)).toEqual([
      "Argentina advances",
      "England advances",
    ]);
  });
});
