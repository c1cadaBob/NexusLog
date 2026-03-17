import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Table,
  Input,
  Button,
  Tag,
  DatePicker,
  Space,
  Tooltip,
  App,
  Popconfirm,
  Alert,
  Empty,
  Checkbox,
  Pagination,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { usePreferencesStore } from "../../stores/preferencesStore";
import type { QueryHistory } from "../../types/log";
import {
  createSavedQuery,
  deleteQueryHistory,
  fetchQueryHistory,
} from "../../api/query";
import { persistPendingRealtimeStartupQuery } from "./realtimeStartupQuery";
import { buildQueryCleanupState } from "./queryCleanupState";
import QueryCleanupPreviewContent from "./queryCleanupPreviewContent";
import { usePaginationQuickJumperAccessibility } from "../../components/common/usePaginationQuickJumperAccessibility";
import {
  formatSearchPageSummary,
  formatSearchPageTotal,
  resolveSearchPageEmptyDescription,
  resolveSearchPageLoadingLabel,
  resolveSearchPageVisibleRange,
} from "./searchPagePresentation";

const MOBILE_BREAKPOINT = 768;

const SearchHistory: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();

  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [rows, setRows] = useState<QueryHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore(
    (s) => s.pageSizes["searchHistory"] ?? 15,
  );
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadedPageSize, setLoadedPageSize] = useState(storedPageSize);
  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeLocal(size);
      setStoredPageSize("searchHistory", size);
    },
    [setStoredPageSize],
  );
  const historyTableRef =
    usePaginationQuickJumperAccessibility("search-history");
  const latestHistoryRequestRef = useRef(0);
  const pendingPaginationRef = useRef<{
    targetPage: number;
    targetPageSize: number;
    previousPage: number;
    previousPageSize: number;
  } | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 查询历史列表使用服务端分页，确保和后端真实数据一致。
  const loadHistory = useCallback(async () => {
    const requestId = latestHistoryRequestRef.current + 1;
    latestHistoryRequestRef.current = requestId;
    setLoading(true);
    setErrorText("");
    try {
      const result = await fetchQueryHistory({
        page: currentPage,
        pageSize,
        keyword,
        from: dateRange?.[0]?.toISOString(),
        to: dateRange?.[1]?.toISOString(),
      });
      if (requestId !== latestHistoryRequestRef.current) {
        return;
      }
      setRows(result.items);
      setTotal(result.total);
      setLoadedPage(result.page);
      setLoadedPageSize(result.pageSize);
      pendingPaginationRef.current = null;
      if (result.page !== currentPage) {
        setCurrentPage(result.page);
      }
      if (result.pageSize !== pageSize) {
        setPageSize(result.pageSize);
      }
    } catch (error) {
      if (requestId !== latestHistoryRequestRef.current) {
        return;
      }
      const readable =
        error instanceof Error ? error.message : "查询历史加载失败";
      const pendingPagination = pendingPaginationRef.current;
      if (
        pendingPagination &&
        pendingPagination.targetPage === currentPage &&
        pendingPagination.targetPageSize === pageSize
      ) {
        pendingPaginationRef.current = null;
        setCurrentPage(pendingPagination.previousPage);
        setPageSize(pendingPagination.previousPageSize);
        message.warning("查询历史分页加载失败，已回退到上一页");
        return;
      }
      setErrorText(readable);
    } finally {
      if (requestId === latestHistoryRequestRef.current) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, keyword, dateRange, setPageSize]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selectedHistoryIDs = useMemo(
    () => selectedRowKeys.map((key) => String(key)),
    [selectedRowKeys],
  );
  const selectedRowKeySet = useMemo(
    () => new Set(selectedRowKeys),
    [selectedRowKeys],
  );
  const visibleRange = useMemo(
    () =>
      resolveSearchPageVisibleRange({
        total,
        page: loadedPage,
        pageSize: loadedPageSize,
        itemCount: rows.length,
      }),
    [loadedPage, loadedPageSize, rows.length, total],
  );
  const historyEmptyDescription = useMemo(() => {
    const hasKeyword = keyword.trim().length > 0;
    const hasDateFilter = Boolean(dateRange?.[0] || dateRange?.[1]);
    return resolveSearchPageEmptyDescription(
      hasKeyword || hasDateFilter,
      "没有匹配的查询历史",
      "暂无查询历史",
    );
  }, [dateRange, keyword]);

  const refreshAfterDelete = useCallback(
    (deletedCount: number) => {
      setSelectedRowKeys([]);
      if (deletedCount <= 0) {
        void loadHistory();
        return;
      }
      const nextTotal = Math.max(0, total - deletedCount);
      const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize));
      const nextPage = Math.min(currentPage, maxPage);
      if (nextPage !== currentPage) {
        setCurrentPage(nextPage);
        return;
      }
      void loadHistory();
    },
    [currentPage, loadHistory, pageSize, total],
  );

  const handleSearch = useCallback((value: string) => {
    setSelectedRowKeys([]);
    setCurrentPage(1);
    setKeyword(value.trim());
  }, []);

  const handleReplay = useCallback(
    async (record: QueryHistory) => {
      const cleanupState = buildQueryCleanupState({ rawQuery: record.query });
      const replayQuery = cleanupState.rawQuery.trim();
      const hasHistoricalTimeRange = Boolean(
        cleanupState.normalized.timeRange?.from?.trim() ||
        cleanupState.normalized.timeRange?.to?.trim(),
      );
      const replayMessage = hasHistoricalTimeRange
        ? "已跳转到实时检索并按原时间范围自动执行"
        : "已跳转到实时检索并自动执行";

      try {
        await navigator.clipboard.writeText(replayQuery);
        message.success(`${replayMessage}，并同步到剪贴板`);
      } catch {
        message.info(`${replayMessage}，但未能同步到剪贴板`);
      }

      persistPendingRealtimeStartupQuery(replayQuery);
      navigate("/search/realtime", {
        state: {
          autoRun: true,
          presetQuery: replayQuery,
        },
      });
    },
    [message, navigate],
  );

  const handleBookmark = useCallback(
    (record: QueryHistory) => {
      const now = new Date();
      const cleanupState = buildQueryCleanupState({ rawQuery: record.query });
      const persistBookmark = async () => {
        try {
          await createSavedQuery({
            name: `历史查询 ${now.toLocaleString("zh-CN")}`,
            query: cleanupState.cleanedQuery,
            tags: ["历史查询"],
          });
          message.success(
            cleanupState.normalized.strippedTimeRange
              ? "已收藏查询语句，并自动移除历史时间范围"
              : "已收藏查询语句",
          );
        } catch (error) {
          const readable = error instanceof Error ? error.message : "收藏失败";
          message.error(readable);
        }
      };

      if (!cleanupState.needsCleanup) {
        void persistBookmark();
        return;
      }

      modal.confirm({
        title: "收藏前将清洗旧格式查询",
        okText: "收藏并清洗",
        cancelText: "取消",
        width: 720,
        content: (
          <QueryCleanupPreviewContent
            cleanupState={cleanupState}
            intro="该历史查询包含回放遗留的时间范围。为避免后续继续传播旧格式，收藏时将仅保留可复用的查询语义。"
            sourceQuery={record.query}
          />
        ),
        onOk: async () => {
          await persistBookmark();
        },
      });
    },
    [message, modal],
  );

  const isMissingHistoryDeleteError = useCallback((error: unknown) => {
    return (
      (error instanceof Error &&
        /query history not found|history not found|query not found|not found|记录不存在|已被删除/i.test(
          error.message,
        )) ||
      (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        Number((error as { status?: number }).status) === 404)
    );
  }, []);

  const handleDelete = useCallback(
    async (historyID: string) => {
      try {
        const deleted = await deleteQueryHistory(historyID);
        if (!deleted) {
          message.warning("记录不存在或已被删除");
          refreshAfterDelete(1);
          return;
        }
        message.success("已删除");
        refreshAfterDelete(1);
      } catch (error) {
        if (isMissingHistoryDeleteError(error)) {
          message.warning("记录不存在或已被删除");
          refreshAfterDelete(1);
          return;
        }
        const readable = error instanceof Error ? error.message : "删除失败";
        message.error(readable);
      }
    },
    [isMissingHistoryDeleteError, message, refreshAfterDelete],
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedHistoryIDs.length === 0) {
      return;
    }
    setBatchDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedHistoryIDs.map((historyID) => deleteQueryHistory(historyID)),
      );
      let deletedCount = 0;
      let missingCount = 0;
      let failedCount = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value) {
            deletedCount += 1;
          } else {
            missingCount += 1;
          }
          return;
        }
        if (isMissingHistoryDeleteError(result.reason)) {
          missingCount += 1;
          return;
        }
        failedCount += 1;
      });

      const affectedCount = deletedCount + missingCount;
      if (deletedCount > 0) {
        message.success(`已删除 ${deletedCount} 条记录`);
      }
      if (affectedCount > 0) {
        refreshAfterDelete(affectedCount);
      } else {
        setSelectedRowKeys([]);
        void loadHistory();
      }

      if (missingCount > 0) {
        message.warning(`${missingCount} 条记录不存在或已被删除`);
      }
      if (failedCount > 0) {
        message.error(`${failedCount} 条记录删除失败，请稍后重试`);
      }
    } finally {
      setBatchDeleting(false);
    }
  }, [isMissingHistoryDeleteError, loadHistory, message, refreshAfterDelete, selectedHistoryIDs]);

  const formatExecutedAt = useCallback(
    (value: string) => new Date(value).toLocaleString("zh-CN"),
    [],
  );

  const renderDurationTag = useCallback((value: number) => {
    const color = value > 1000 ? "error" : value > 500 ? "warning" : "success";
    return (
      <Tag color={color} style={{ margin: 0, fontSize: 12 }}>
        {value}ms
      </Tag>
    );
  }, []);

  const handleVisibleRowsSelectionChange = useCallback(
    (checked: boolean) => {
      setSelectedRowKeys((previousKeys) => {
        const nextKeys = new Set(previousKeys);
        rows.forEach((row) => {
          if (checked) {
            nextKeys.add(row.id);
            return;
          }
          nextKeys.delete(row.id);
        });
        return Array.from(nextKeys);
      });
    },
    [rows],
  );

  const handleRowSelectionChange = useCallback(
    (rowID: string, checked: boolean) => {
      setSelectedRowKeys((previousKeys) => {
        const nextKeys = new Set(previousKeys);
        if (checked) {
          nextKeys.add(rowID);
        } else {
          nextKeys.delete(rowID);
        }
        return Array.from(nextKeys);
      });
    },
    [],
  );

  const visibleRowsSelectedCount = useMemo(
    () => rows.filter((row) => selectedRowKeySet.has(row.id)).length,
    [rows, selectedRowKeySet],
  );
  const allVisibleRowsSelected = rows.length > 0 && visibleRowsSelectedCount === rows.length;
  const someVisibleRowsSelected =
    visibleRowsSelectedCount > 0 && visibleRowsSelectedCount < rows.length;

  const renderActionButtons = useCallback(
    (record: QueryHistory, mode: "table" | "mobile" = "table") => {
      const compact = mode === "table";
      const buttonSize = compact ? "small" : "middle";
      const buttonStyle = compact ? undefined : { minHeight: 36 };
      return (
        <Space size="small" wrap>
          <Tooltip title="重新执行">
            <Button
              type={compact ? "link" : "default"}
              size={buttonSize}
              style={buttonStyle}
              icon={
                <span className="material-symbols-outlined text-sm">
                  replay
                </span>
              }
              onClick={() => void handleReplay(record)}
            >
              {compact ? null : "重新执行"}
            </Button>
          </Tooltip>
          <Tooltip title="收藏">
            <Button
              type={compact ? "link" : "default"}
              size={buttonSize}
              style={buttonStyle}
              icon={
                <span className="material-symbols-outlined text-sm">
                  bookmark_add
                </span>
              }
              onClick={() => void handleBookmark(record)}
            >
              {compact ? null : "收藏"}
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，是否继续？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button
                type={compact ? "link" : "default"}
                size={buttonSize}
                style={buttonStyle}
                danger
                icon={
                  <span className="material-symbols-outlined text-sm">
                    delete
                  </span>
                }
              >
                {compact ? null : "删除"}
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      );
    },
    [handleBookmark, handleDelete, handleReplay],
  );

  const columns: ColumnsType<QueryHistory> = useMemo(
    () => [
      {
        title: "序号",
        key: "index",
        width: 80,
        align: "center",
        render: (_: unknown, __: QueryHistory, index: number) => (
          <span className="text-sm opacity-60">
            {(loadedPage - 1) * loadedPageSize + index + 1}
          </span>
        ),
      },
      {
        title: "查询语句",
        dataIndex: "query",
        key: "query",
        ellipsis: true,
        render: (v: string) => (
          <span className="font-mono text-sm pl-2">{v}</span>
        ),
      },
      {
        title: "执行时间",
        dataIndex: "executedAt",
        key: "executedAt",
        width: 180,
        render: (v: string) => (
          <span className="text-sm opacity-70">{formatExecutedAt(v)}</span>
        ),
      },
      {
        title: "耗时",
        dataIndex: "duration",
        key: "duration",
        width: 100,
        render: (v: number) => renderDurationTag(v),
      },
      {
        title: "结果数量",
        dataIndex: "resultCount",
        key: "resultCount",
        width: 120,
        render: (v: number) => (
          <span className="text-sm">{v.toLocaleString()}</span>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: 170,
        render: (_: unknown, record: QueryHistory) =>
          renderActionButtons(record, "table"),
      },
    ],
    [formatExecutedAt, loadedPage, loadedPageSize, renderActionButtons, renderDurationTag],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={isMobile ? "flex flex-col gap-3" : "flex items-center gap-3 flex-wrap"}>
        <Input.Search
          id="search-history-keyword"
          name="search-history-keyword"
          autoComplete="off"
          size={isMobile ? "large" : "middle"}
          placeholder="搜索查询语句..."
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onSearch={handleSearch}
          allowClear
          style={{ width: isMobile ? "100%" : 300 }}
        />
        <DatePicker.RangePicker
          id={{ start: "search-history-start", end: "search-history-end" }}
          size={isMobile ? "large" : "middle"}
          value={dateRange}
          showTime={{ format: "HH:mm:ss" }}
          format="YYYY-MM-DD HH:mm:ss"
          onChange={(dates) => {
            setSelectedRowKeys([]);
            setCurrentPage(1);
            setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
          }}
          placeholder={["开始时间", "结束时间"]}
          style={isMobile ? { width: "100%" } : undefined}
        />
        <div className={isMobile ? "grid grid-cols-2 gap-2" : "contents"}>
          <Button
            size={isMobile ? "large" : "middle"}
            onClick={() => {
              setSelectedRowKeys([]);
              setKeywordInput("");
              setKeyword("");
              setDateRange(null);
              setCurrentPage(1);
            }}
            className={isMobile ? "w-full" : undefined}
          >
            重置
          </Button>
          <Popconfirm
            title="确认批量删除"
            description={`将删除选中的 ${selectedHistoryIDs.length} 条查询历史，删除后不可恢复，是否继续？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: batchDeleting }}
            disabled={selectedHistoryIDs.length === 0}
            onConfirm={() => void handleBatchDelete()}
          >
            <span className={isMobile ? "w-full" : undefined}>
              <Button
                size={isMobile ? "large" : "middle"}
                danger
                className={isMobile ? "w-full" : undefined}
                disabled={selectedHistoryIDs.length === 0}
                loading={batchDeleting}
                icon={
                  <span className="material-symbols-outlined text-sm">
                    delete_sweep
                  </span>
                }
              >
                批量删除
              </Button>
            </span>
          </Popconfirm>
        </div>
        <div className={isMobile ? "flex flex-wrap items-center gap-2 text-xs" : "flex flex-wrap items-center gap-3 text-xs"}>
          <span className="opacity-50">
            {formatSearchPageSummary(total, "条记录", visibleRange, "条")}
          </span>
          {loading && !batchDeleting && (
            <Tag color="processing" style={{ margin: 0 }}>
              {resolveSearchPageLoadingLabel(rows.length)}
            </Tag>
          )}
          {selectedHistoryIDs.length > 0 && (
            <span className="text-blue-500">
              已选择 {selectedHistoryIDs.length} 项
            </span>
          )}
        </div>
      </div>

      {errorText && (
        <Alert
          type="error"
          showIcon
          message="查询历史加载失败"
          description={errorText}
          action={
            <Button size="small" onClick={() => void loadHistory()}>
              重试
            </Button>
          }
        />
      )}

      {isMobile ? (
        <div className="flex flex-col gap-3">
          {rows.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] px-4 py-3">
              <Checkbox
                id="search-history-mobile-select-all"
                name="search-history-mobile-select-all"
                checked={allVisibleRowsSelected}
                indeterminate={someVisibleRowsSelected}
                disabled={batchDeleting}
                aria-label="选择当前页全部查询历史"
                onChange={(event) =>
                  handleVisibleRowsSelectionChange(event.target.checked)
                }
              >
                当前页全选
              </Checkbox>
              <span className="text-xs opacity-60">
                当前页 {rows.length} 条
              </span>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-6">
              <Empty description={historyEmptyDescription} />
            </div>
          ) : (
            rows.map((record, index) => (
              <div
                key={record.id}
                className="rounded-xl border border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`search-history-mobile-select-${record.id}`}
                    name={`search-history-mobile-select-${record.id}`}
                    checked={selectedRowKeySet.has(record.id)}
                    disabled={batchDeleting}
                    aria-label={`选择查询历史 ${record.id}`}
                    onChange={(event) =>
                      handleRowSelectionChange(record.id, event.target.checked)
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag color="default" style={{ margin: 0, fontSize: 12 }}>
                        #{(loadedPage - 1) * loadedPageSize + index + 1}
                      </Tag>
                      {renderDurationTag(record.duration)}
                      <Tag color="blue" style={{ margin: 0, fontSize: 12 }}>
                        {record.resultCount.toLocaleString()} 条结果
                      </Tag>
                    </div>
                    <div className="mt-3 break-all font-mono text-sm leading-6">
                      {record.query}
                    </div>
                    <div className="mt-3 text-xs opacity-70">
                      执行时间：{formatExecutedAt(record.executedAt)}
                    </div>
                    <div className="mt-4">
                      {renderActionButtons(record, "mobile")}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={total}
            size="small"
            showSizeChanger
            showQuickJumper={false}
            showTotal={(count) => formatSearchPageTotal(count, "条")}
            pageSizeOptions={["10", "15", "20", "50", "100"]}
            onChange={(page, size) => {
              setSelectedRowKeys([]);
              const nextPageSize = size ?? pageSize;
              const targetPage = nextPageSize !== pageSize ? 1 : page;
              pendingPaginationRef.current = {
                targetPage,
                targetPageSize: nextPageSize,
                previousPage: currentPage,
                previousPageSize: pageSize,
              };
              setCurrentPage(targetPage);
              setPageSize(nextPageSize);
            }}
          />
        </div>
      ) : (
        <div ref={historyTableRef}>
          <Table<QueryHistory>
            dataSource={rows}
            columns={columns}
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              preserveSelectedRowKeys: true,
              getTitleCheckboxProps: () => ({
                id: "search-history-select-all",
                name: "search-history-select-all",
                "aria-label": "选择全部查询历史",
              }),
              getCheckboxProps: (record) => ({
                disabled: batchDeleting,
                id: `search-history-select-${record.id}`,
                name: `search-history-select-${record.id}`,
                "aria-label": `选择查询历史 ${record.id}`,
              }),
            }}
            size="small"
            loading={loading || batchDeleting}
            locale={{
              emptyText: <Empty description={historyEmptyDescription} />,
            }}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (count) => formatSearchPageTotal(count, "条"),
              pageSizeOptions: ["10", "15", "20", "50", "100"],
              position: ["bottomLeft"],
              onChange: (page, size) => {
                setSelectedRowKeys([]);
                const nextPageSize = size ?? pageSize;
                const targetPage = nextPageSize !== pageSize ? 1 : page;
                pendingPaginationRef.current = {
                  targetPage,
                  targetPageSize: nextPageSize,
                  previousPage: currentPage,
                  previousPageSize: pageSize,
                };
                setCurrentPage(targetPage);
                setPageSize(nextPageSize);
              },
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SearchHistory;
