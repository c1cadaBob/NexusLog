import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Card,
  Input,
  Tag,
  Button,
  Row,
  Col,
  Space,
  Empty,
  Tooltip,
  App,
  Modal,
  Form,
  Select,
  Popconfirm,
  Alert,
  Pagination,
} from "antd";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../../theme/tokens";
import { usePreferencesStore } from "../../stores/preferencesStore";
import type { SavedQuery } from "../../types/log";
import {
  createSavedQuery,
  deleteSavedQuery,
  fetchSavedQueries,
  updateSavedQuery,
} from "../../api/query";
import { persistPendingRealtimeStartupQuery } from "./realtimeStartupQuery";
import { buildQueryCleanupState } from "./queryCleanupState";
import QueryCleanupPreviewContent from "./queryCleanupPreviewContent";
import { usePaginationQuickJumperAccessibility } from "../../components/common/usePaginationQuickJumperAccessibility";
import InlineLoadingState from "../../components/common/InlineLoadingState";
import InlineErrorState from "../../components/common/InlineErrorState";
import {
  formatSearchPageSummary,
  formatSearchPageTotal,
  resolveSearchPageEmptyDescription,
  resolveSearchPageLoadingLabel,
  resolveSearchPageVisibleRange,
} from "./searchPagePresentation";

type ModalMode = "create" | "edit";

const MOBILE_BREAKPOINT = 768;

const SavedQueries: React.FC = () => {
  const { message: msg, modal } = App.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [savedList, setSavedList] = useState<SavedQuery[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [retryingSavedQueries, setRetryingSavedQueries] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const storedPageSize = usePreferencesStore(
    (s) => s.pageSizes.savedQueries ?? 12,
  );
  const setStoredPageSize = usePreferencesStore((s) => s.setPageSize);
  const [pageSize, setPageSizeLocal] = useState(storedPageSize);
  const [isMobile, setIsMobile] = useState(false);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadedPageSize, setLoadedPageSize] = useState(storedPageSize);
  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeLocal(size);
      setStoredPageSize("savedQueries", size);
    },
    [setStoredPageSize],
  );
  const savedPaginationRef =
    usePaginationQuickJumperAccessibility("saved-queries");
  const latestSavedRequestRef = useRef(0);
  const pendingPaginationRef = useRef<{
    targetPage: number;
    targetPageSize: number;
    previousPage: number;
    previousPageSize: number;
  } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingItem, setEditingItem] = useState<SavedQuery | null>(null);
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const watchedModalQuery = Form.useWatch("query", form);

  const visibleRange = useMemo(
    () =>
      resolveSearchPageVisibleRange({
        total,
        page: loadedPage,
        pageSize: loadedPageSize,
        itemCount: savedList.length,
      }),
    [loadedPage, loadedPageSize, savedList.length, total],
  );

  const savedEmptyDescription = useMemo(
    () =>
      resolveSearchPageEmptyDescription(
        Boolean(appliedSearch || selectedTag),
        "没有匹配的收藏查询",
        "暂无收藏查询",
      ),
    [appliedSearch, selectedTag],
  );

  const mergedTags = useMemo(() => {
    const values = new Set<string>(knownTags);
    savedList.forEach((item) => item.tags.forEach((tag) => values.add(tag)));
    if (selectedTag) {
      values.add(selectedTag);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [knownTags, savedList, selectedTag]);

  const savedQueryDiagnostics = useMemo(
    () =>
      savedList.map((item) => ({
        item,
        ...buildQueryCleanupState({ rawQuery: item.query }),
      })),
    [savedList],
  );

  const dirtySavedQueries = useMemo(
    () => savedQueryDiagnostics.filter((entry) => entry.needsCleanup),
    [savedQueryDiagnostics],
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const modalQueryCleanupPreview = useMemo(() => {
    const rawQuery =
      typeof watchedModalQuery === "string" ? watchedModalQuery.trim() : "";
    if (!rawQuery) {
      return null;
    }

    const cleanupState = buildQueryCleanupState({ rawQuery });
    return cleanupState.needsCleanup ? cleanupState : null;
  }, [watchedModalQuery]);

  // 收藏查询改为真实 API 数据源，页面仅做展示和交互。
  const loadSavedQueries = useCallback(async () => {
    const requestId = latestSavedRequestRef.current + 1;
    latestSavedRequestRef.current = requestId;
    setLoading(true);
    setErrorText("");
    try {
      const result = await fetchSavedQueries({
        page: currentPage,
        pageSize,
        keyword: appliedSearch,
        tag: selectedTag ?? undefined,
      });
      if (requestId !== latestSavedRequestRef.current) {
        return;
      }
      setSavedList(result.items);
      setTotal(result.total);
      setLoadedPage(result.page);
      setLoadedPageSize(result.pageSize);
      pendingPaginationRef.current = null;
      if (Array.isArray(result.availableTags)) {
        setKnownTags(result.availableTags);
      } else {
        setKnownTags((prev) => {
          const merged = new Set(prev);
          result.items.forEach((item) =>
            item.tags.forEach((tag) => merged.add(tag)),
          );
          return Array.from(merged).sort((a, b) => a.localeCompare(b, "zh-CN"));
        });
      }
      if (result.page !== currentPage) {
        setCurrentPage(result.page);
      }
      if (result.pageSize !== pageSize) {
        setPageSize(result.pageSize);
      }
    } catch (error) {
      if (requestId !== latestSavedRequestRef.current) {
        return;
      }
      const readable =
        error instanceof Error ? error.message : "加载收藏查询失败";
      const pendingPagination = pendingPaginationRef.current;
      if (
        pendingPagination &&
        pendingPagination.targetPage === currentPage &&
        pendingPagination.targetPageSize === pageSize
      ) {
        pendingPaginationRef.current = null;
        setCurrentPage(pendingPagination.previousPage);
        setPageSize(pendingPagination.previousPageSize);
        msg.warning("收藏查询分页加载失败，已回退到上一页");
        return;
      }
      setErrorText(readable);
    } finally {
      if (requestId === latestSavedRequestRef.current) {
        setHasLoadedOnce(true);
        setLoading(false);
      }
    }
  }, [appliedSearch, currentPage, pageSize, selectedTag]);

  useEffect(() => {
    void loadSavedQueries();
  }, [loadSavedQueries]);

  const openCreateModal = useCallback(() => {
    setModalMode("create");
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ tags: [] });
    setEditModalOpen(true);
  }, [form]);

  const openEditModal = useCallback(
    (item: SavedQuery) => {
      setModalMode("edit");
      setEditingItem(item);
      form.setFieldsValue({
        name: item.name,
        query: item.query,
        tags: item.tags,
      });
      setEditModalOpen(true);
    },
    [form],
  );

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const rawQuery = String(values.query ?? "").trim();
      const cleanupState = buildQueryCleanupState({ rawQuery });
      const cleanedQuery = cleanupState.cleanedQuery;
      const payload = {
        name: String(values.name ?? "").trim(),
        query: cleanedQuery,
        tags: Array.isArray(values.tags)
          ? values.tags
              .map((tag: unknown) => String(tag).trim())
              .filter(Boolean)
          : [],
      };
      if (!payload.name || !payload.query) {
        msg.warning("请填写完整查询名称和语句");
        return;
      }

      const normalizedChangedQuery = cleanupState.needsCleanup;
      if (modalMode === "create") {
        await createSavedQuery(payload);
        msg.success(
          normalizedChangedQuery
            ? "已创建收藏查询，并自动清洗旧格式时间范围"
            : "已创建收藏查询",
        );
      } else if (editingItem) {
        await updateSavedQuery(editingItem.id, payload);
        msg.success(
          normalizedChangedQuery
            ? "已保存修改，并自动清洗旧格式时间范围"
            : "已保存修改",
        );
      }

      setEditModalOpen(false);
      setEditingItem(null);
      if (currentPage !== 1 && modalMode === "create") {
        setCurrentPage(1);
        return;
      }
      void loadSavedQueries();
    } catch (error) {
      if (error instanceof Error && error.message.includes("required")) {
        return;
      }
      const readable = error instanceof Error ? error.message : "保存失败";
      msg.error(readable);
    }
  }, [currentPage, editingItem, form, loadSavedQueries, modalMode, msg]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const deleted = await deleteSavedQuery(id);
        if (!deleted) {
          msg.warning("记录不存在或已被删除");
          if (savedList.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
            return;
          }
          void loadSavedQueries();
          return;
        }
        msg.success("已删除");
        if (savedList.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
          return;
        }
        void loadSavedQueries();
      } catch (error) {
        const missingSavedQuery =
          (error instanceof Error &&
            /saved query not found|query not found|not found|记录不存在|已被删除/i.test(
              error.message,
            )) ||
          (typeof error === "object" &&
            error !== null &&
            "status" in error &&
            Number((error as { status?: number }).status) === 404);
        if (missingSavedQuery) {
          msg.warning("记录不存在或已被删除");
          if (savedList.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
            return;
          }
          void loadSavedQueries();
          return;
        }
        const readable = error instanceof Error ? error.message : "删除失败";
        msg.error(readable);
      }
    },
    [currentPage, loadSavedQueries, msg, savedList.length],
  );

  const handleExecute = useCallback(
    async (item: SavedQuery) => {
      const presetQuery = item.query.trim();
      if (!presetQuery) {
        msg.warning("收藏查询语句为空，无法执行");
        return;
      }
      const executeMessage = "已跳转到实时检索并自动执行";
      try {
        await navigator.clipboard.writeText(presetQuery);
        msg.success(`${executeMessage}，并同步到剪贴板`);
      } catch {
        msg.info(`${executeMessage}，但未能同步到剪贴板`);
      }
      persistPendingRealtimeStartupQuery(presetQuery);
      navigate("/search/realtime", {
        state: {
          autoRun: true,
          presetQuery,
        },
      });
    },
    [msg, navigate],
  );

  const performCleanupDirtyQueries = useCallback(async () => {
    if (dirtySavedQueries.length === 0) {
      return;
    }
    setCleanupSubmitting(true);
    try {
      const results = await Promise.allSettled(
        dirtySavedQueries.map(({ item, cleanedQuery }) =>
          updateSavedQuery(item.id, {
            name: item.name,
            query: cleanedQuery,
            tags: item.tags,
          }),
        ),
      );
      let successCount = 0;
      let failedCount = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successCount += 1;
          return;
        }
        failedCount += 1;
      });

      if (successCount > 0) {
        msg.success(`已清洗 ${successCount} 条旧格式收藏查询`);
        void loadSavedQueries();
      }
      if (failedCount > 0) {
        msg.error(`${failedCount} 条收藏查询清洗失败，请稍后重试`);
      }
    } finally {
      setCleanupSubmitting(false);
    }
  }, [dirtySavedQueries, loadSavedQueries, msg]);

  const handleCleanupDirtyQueries = useCallback(() => {
    if (dirtySavedQueries.length === 0) {
      return;
    }

    modal.confirm({
      title: "批量清洗旧格式收藏查询",
      okText: "确认清洗",
      cancelText: "取消",
      width: 760,
      content: (
        <div className="flex flex-col gap-3">
          <div className="text-sm opacity-80">
            以下收藏查询仍包含历史时间范围。确认后会批量移除旧格式时间范围，仅保留可复用的查询语义与筛选条件。
          </div>
          <div className="flex gap-2 flex-wrap">
            <Tag color="warning" style={{ margin: 0 }}>
              待清洗 {dirtySavedQueries.length} 条收藏
            </Tag>
          </div>
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
            {dirtySavedQueries.map(({ item, cleanedQuery, previewFilters }) => (
              <div
                key={item.id}
                className="rounded border p-3 flex flex-col gap-2"
                style={{ borderColor: "rgba(245, 158, 11, 0.28)" }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium">{item.name}</div>
                  {previewFilters.length > 0 && (
                    <Tag color="blue" style={{ margin: 0 }}>
                      保留 {previewFilters.length} 个筛选条件
                    </Tag>
                  )}
                </div>
                {previewFilters.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="text-xs opacity-60">保留筛选</div>
                    <div className="flex gap-2 flex-wrap">
                      {previewFilters.map((filter) => (
                        <Tag
                          key={`${item.id}-${filter.key}`}
                          color="blue"
                          style={{ margin: 0 }}
                        >
                          {filter.label}: {filter.value}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <div className="text-xs opacity-60">当前收藏</div>
                  <div
                    className="font-mono text-sm p-2 rounded break-all"
                    style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
                  >
                    {item.query}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-xs opacity-60">清洗后写入</div>
                  <div
                    className="font-mono text-sm p-2 rounded break-all"
                    style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                  >
                    {cleanedQuery}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      onOk: async () => {
        await performCleanupDirtyQueries();
      },
    });
  }, [dirtySavedQueries, modal, performCleanupDirtyQueries]);

  const savedLoadingPlaceholderVisible =
    loading && savedList.length === 0 && !retryingSavedQueries;
  const showSavedInlineErrorState =
    (Boolean(errorText) || retryingSavedQueries) &&
    savedList.length === 0 &&
    !savedLoadingPlaceholderVisible;
  const savedSummaryText = savedLoadingPlaceholderVisible
    ? "正在加载收藏查询..."
    : retryingSavedQueries && savedList.length === 0
      ? "正在重试收藏查询..."
      : formatSearchPageSummary(total, "个收藏", visibleRange, "个");

  const renderSavedQueryActions = useCallback(
    (item: SavedQuery) => {
      const actionButtonSize = isMobile ? "middle" : "small";
      const actionButtonStyle = isMobile ? { minHeight: 36 } : undefined;
      const executeButton = (
        <Button
          type={isMobile ? "default" : "text"}
          size={actionButtonSize}
          style={actionButtonStyle}
          icon={
            <span className="material-symbols-outlined text-sm">
              play_arrow
            </span>
          }
          onClick={() => void handleExecute(item)}
          aria-label={isMobile ? `执行收藏查询 ${item.name}` : undefined}
        >
          {isMobile ? "执行" : null}
        </Button>
      );
      const editButton = (
        <Button
          type={isMobile ? "default" : "text"}
          size={actionButtonSize}
          style={actionButtonStyle}
          icon={
            <span className="material-symbols-outlined text-sm">edit</span>
          }
          onClick={() => openEditModal(item)}
          aria-label={isMobile ? `编辑收藏查询 ${item.name}` : undefined}
        >
          {isMobile ? "编辑" : null}
        </Button>
      );
      const deleteButton = (
        <Button
          type={isMobile ? "default" : "text"}
          size={actionButtonSize}
          style={actionButtonStyle}
          danger
          icon={
            <span className="material-symbols-outlined text-sm">delete</span>
          }
          aria-label={isMobile ? `删除收藏查询 ${item.name}` : undefined}
        >
          {isMobile ? "删除" : null}
        </Button>
      );

      if (isMobile) {
        return (
          <Space size="small" wrap>
            {executeButton}
            {editButton}
            <Popconfirm
              title="确认删除"
              description={`确定要删除「${item.name}」吗？`}
              onConfirm={() => void handleDelete(item.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              {deleteButton}
            </Popconfirm>
          </Space>
        );
      }

      return (
        <Space size={0}>
          <Tooltip title="执行">{executeButton}</Tooltip>
          <Tooltip title="编辑">{editButton}</Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除「${item.name}」吗？`}
            onConfirm={() => void handleDelete(item.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">{deleteButton}</Tooltip>
          </Popconfirm>
        </Space>
      );
    },
    [handleDelete, handleExecute, isMobile, openEditModal],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input.Search
          id="saved-query-search"
          name="saved-query-search"
          autoComplete="off"
          size={isMobile ? "large" : "middle"}
          placeholder="搜索查询名称或语句..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => {
            setCurrentPage(1);
            setAppliedSearch(value.trim());
          }}
          allowClear
          style={{ width: isMobile ? "100%" : 300 }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Tag
            className="cursor-pointer"
            color={selectedTag === null ? "blue" : undefined}
            style={isMobile ? { margin: 0, minHeight: 32, paddingInline: 12, display: "inline-flex", alignItems: "center" } : undefined}
            onClick={() => {
              setSelectedTag(null);
              setCurrentPage(1);
            }}
          >
            全部
          </Tag>
          {mergedTags.map((tag) => (
            <Tag
              key={tag}
              className="cursor-pointer"
              color={selectedTag === tag ? "blue" : undefined}
              style={isMobile ? { margin: 0, minHeight: 32, paddingInline: 12, display: "inline-flex", alignItems: "center" } : undefined}
              onClick={() => {
                setSelectedTag(selectedTag === tag ? null : tag);
                setCurrentPage(1);
              }}
            >
              {tag}
            </Tag>
          ))}
        </div>
        <Button size={isMobile ? "large" : "middle"} onClick={openCreateModal} type="primary">
          新建收藏
        </Button>
        <Button
          size={isMobile ? "large" : "middle"}
          onClick={() => {
            setSearchText("");
            setAppliedSearch("");
            setSelectedTag(null);
            setCurrentPage(1);
          }}
        >
          重置
        </Button>
        <span
          className={isMobile ? "w-full text-xs opacity-50" : "text-sm opacity-50 ml-auto"}
        >
          {savedSummaryText}
        </span>
        {loading && hasLoadedOnce && savedList.length > 0 && (
          <Tag color="processing" style={{ margin: 0 }}>
            {resolveSearchPageLoadingLabel(savedList.length)}
          </Tag>
        )}
      </div>

      {errorText && !showSavedInlineErrorState && (
        <Alert
          type="error"
          showIcon
          message="收藏查询加载失败"
          description={errorText}
          action={
            <Button
              size="small"
              loading={retryingSavedQueries}
              onClick={() => {
                setRetryingSavedQueries(true);
                void loadSavedQueries().finally(() => {
                  setRetryingSavedQueries(false);
                });
              }}
            >
              重试
            </Button>
          }
        />
      )}

      {dirtySavedQueries.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`检测到 ${dirtySavedQueries.length} 条旧格式收藏查询`}
          description="这些查询仍包含历史回放遗留的时间范围，执行时虽然已兼容，但建议一键清洗，避免后续继续传播旧格式。"
          action={
            <Button
              size="small"
              type="primary"
              loading={cleanupSubmitting}
              onClick={() => void handleCleanupDirtyQueries()}
            >
              一键清洗
            </Button>
          }
        />
      )}

      {savedLoadingPlaceholderVisible ? (
        <div className="py-8">
          <InlineLoadingState size="large" tip="加载收藏查询..." />
        </div>
      ) : showSavedInlineErrorState ? (
        <div className="rounded-xl border border-dashed border-[var(--ant-color-border-secondary)] bg-[var(--ant-color-bg-container)] p-6">
          <InlineErrorState
            title="收藏查询加载失败"
            description={errorText || "正在重新请求，请稍候..."}
            actionLoading={retryingSavedQueries}
            onAction={() => {
              setRetryingSavedQueries(true);
              void loadSavedQueries().finally(() => {
                setRetryingSavedQueries(false);
              });
            }}
          />
        </div>
      ) : savedList.length === 0 ? (
        <Empty description={savedEmptyDescription} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {savedQueryDiagnostics.map(
              ({ item, normalized, needsCleanup, previewFilters }) => (
                <Col key={item.id} xs={24} md={12} xl={8}>
                  <Card
                    hoverable
                    size="small"
                    styles={{ body: { padding: isMobile ? 14 : 16 } }}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span
                            className="material-symbols-outlined text-base shrink-0"
                            style={{ color: COLORS.warning }}
                          >
                            bookmark
                          </span>
                          <span className="text-sm font-medium break-all">
                            {item.name}
                          </span>
                          {needsCleanup && (
                            <Tag color="warning" style={{ margin: 0 }}>
                              旧格式
                            </Tag>
                          )}
                          {Object.keys(normalized.filters).length > 0 && (
                            <Tag color="blue" style={{ margin: 0 }}>
                              含筛选
                            </Tag>
                          )}
                        </div>
                        {!isMobile && renderSavedQueryActions(item)}
                      </div>

                      <div
                        className={`font-mono text-sm p-2 rounded ${
                          isMobile
                            ? "break-all whitespace-pre-wrap leading-6"
                            : "overflow-hidden text-ellipsis whitespace-nowrap"
                        }`}
                        style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                        title={item.query}
                      >
                        {item.query}
                      </div>

                      {isMobile && (
                        <div className="flex justify-end">
                          {renderSavedQueryActions(item)}
                        </div>
                      )}

                      {previewFilters.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <div className="text-xs opacity-50">
                            {needsCleanup ? "清洗后保留筛选" : "筛选条件"}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {previewFilters.map((filter) => (
                              <Tag
                                key={`${item.id}-${filter.key}`}
                                color="blue"
                                style={{ margin: 0 }}
                              >
                                {filter.label}: {filter.value}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">
                          {item.tags.map((tag) => (
                            <Tag
                              key={tag}
                              style={{
                                fontSize: 12,
                                margin: 0,
                                lineHeight: "18px",
                                padding: "0 6px",
                              }}
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                        <span className="text-xs opacity-40 shrink-0">
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Col>
              ),
            )}
          </Row>

          <div ref={savedPaginationRef} className="flex justify-start">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showQuickJumper={!isMobile}
              pageSizeOptions={["6", "12", "24", "48"]}
              showTotal={(count) => formatSearchPageTotal(count, "个收藏")}
              onChange={(page, size) => {
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
        </>
      )}

      <Modal
        title={modalMode === "create" ? "新建收藏查询" : "编辑收藏查询"}
        open={editModalOpen}
        onOk={() => void handleSave()}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingItem(null);
        }}
        okText={modalMode === "create" ? "创建" : "保存"}
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="查询名称"
            rules={[{ required: true, message: "请输入查询名称" }]}
          >
            <Input autoComplete="off" placeholder="例如：支付服务错误" />
          </Form.Item>
          <Form.Item
            name="query"
            label="查询语句"
            rules={[{ required: true, message: "请输入查询语句" }]}
          >
            <Input.TextArea
              autoComplete="off"
              rows={3}
              placeholder='例如: level:error AND service:"payment-service"'
              className="font-mono"
            />
          </Form.Item>
          {modalQueryCleanupPreview && (
            <Alert
              type="warning"
              showIcon
              message="检测到旧格式查询语句"
              description={
                <QueryCleanupPreviewContent
                  cleanupState={modalQueryCleanupPreview}
                  rootClassName="flex flex-col gap-2"
                  secondaryTextClassName="text-xs opacity-70"
                  showFilterCountTag={modalQueryCleanupPreview.extractedFilters}
                  showSourceQuery={false}
                  cleanedQueryLabel="保存后将自动清洗为以下查询语句："
                />
              }
            />
          )}
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入或选择标签"
              options={mergedTags.map((tag) => ({ label: tag, value: tag }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SavedQueries;
