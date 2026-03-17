import { describe, expect, it } from "vitest";

import {
  formatSearchPageSummary,
  formatSearchPageTotal,
  resolveRealtimeLogsEmptyDescription,
  resolveSearchPageEmptyDescription,
  resolveSearchPageLoadingLabel,
  resolveSearchPageVisibleRange,
} from "../src/pages/search/searchPagePresentation";

describe("searchPagePresentation", () => {
  it("resolves visible range from loaded page metadata", () => {
    expect(
      resolveSearchPageVisibleRange({
        total: 24,
        page: 2,
        pageSize: 12,
        itemCount: 5,
      }),
    ).toEqual({ start: 13, end: 17 });
  });

  it("returns zero range when list is empty", () => {
    expect(
      resolveSearchPageVisibleRange({
        total: 0,
        page: 1,
        pageSize: 12,
        itemCount: 0,
      }),
    ).toEqual({ start: 0, end: 0 });
  });

  it("formats total and summary labels", () => {
    expect(formatSearchPageTotal(24, "条")).toBe("共 24 条");
    expect(
      formatSearchPageSummary(24, "个收藏", { start: 13, end: 17 }, "个"),
    ).toBe("共 24 个收藏（当前显示第 13-17 个）");
    expect(
      formatSearchPageSummary(0, "条记录", { start: 0, end: 0 }, "条"),
    ).toBe("共 0 条记录");
  });

  it("resolves common loading and empty descriptions", () => {
    expect(resolveSearchPageLoadingLabel(0)).toBe("加载中");
    expect(resolveSearchPageLoadingLabel(3)).toBe("刷新中");
    expect(
      resolveSearchPageEmptyDescription(
        true,
        "没有匹配的查询历史",
        "暂无查询历史",
      ),
    ).toBe("没有匹配的查询历史");
    expect(
      resolveSearchPageEmptyDescription(
        false,
        "没有匹配的查询历史",
        "暂无查询历史",
      ),
    ).toBe("暂无查询历史");
  });

  it("resolves realtime empty description from active filters and time range", () => {
    expect(resolveRealtimeLogsEmptyDescription({ queryText: "error" })).toBe(
      "当前条件下没有匹配日志",
    );
    expect(resolveRealtimeLogsEmptyDescription({ levelFilter: "error" })).toBe(
      "当前条件下没有匹配日志",
    );
    expect(
      resolveRealtimeLogsEmptyDescription({ hasCustomTimeRange: true }),
    ).toBe("所选时间范围暂无日志");
    expect(resolveRealtimeLogsEmptyDescription({ liveWindow: "all" })).toBe(
      "全部时间范围暂无日志",
    );
    expect(resolveRealtimeLogsEmptyDescription({ liveWindow: "15m" })).toBe(
      "当前时间范围暂无日志",
    );
  });
});
