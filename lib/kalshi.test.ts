import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEvent } from "./kalshi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

  it("retries rate limits and falls back to the event-filtered markets endpoint", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({
          markets: [
            {
              ticker: "KXTEST-99MATCH-YES",
              event_ticker: "KXTEST-99MATCH",
              title: "Test match: To Win",
              yes_sub_title: "Test team wins",
              yes_bid_dollars: "0.4900",
              yes_ask_dollars: "0.5100",
              no_bid_dollars: "0.4900",
              no_ask_dollars: "0.5100",
              status: "active",
              result: "",
              close_time: "2099-08-12T19:00:00Z",
              volume_24h_fp: "100.00",
            },
          ],
          cursor: "",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchEvent("KXTEST-99MATCH");
    await vi.runAllTimersAsync();
    const event = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[4]?.[0])).toContain(
      "/markets?event_ticker=KXTEST-99MATCH&status=open&limit=100",
    );
    expect(event?.title).toBe("Test match");
    expect(event?.markets[0]?.yesSubTitle).toBe("Test team wins");
  });
});
