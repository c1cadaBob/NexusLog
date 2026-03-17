import React, { useState, useMemo } from 'react';
import { useThemeStore } from '../../stores/themeStore';

// FAQ 数据
const faqData = [
  {
    category: '数据接入 (Ingestion)',
    icon: 'input',
    questions: [
      {
        id: 'logstash-config',
        question: '如何配置 Logstash 进行数据转发？',
        answer: '要配置 Logstash，您需要编辑 `logstash.conf` 文件。在 output 部分，指向我们的接收端点。',
        code: `output {\n  http {\n    url => "https://api.logsystem.com/v1/ingest"\n    http_method => "post"\n    headers => {\n      "Authorization" => "Bearer YOUR_API_KEY"\n    }\n  }\n}`,
        tags: ['logstash', '配置', '数据转发', 'agent']
      },
      {
        id: 'data-delay',
        question: '数据上报有延迟怎么办？',
        answer: '首先，请检查您的网络带宽和 Agent 资源使用情况。如果网络正常，您可以尝试增加 Agent 的批处理大小 (batch size) 或增加工作线程数。如果问题持续存在，请联系支持团队并提供 Agent 日志。',
        tags: ['延迟', '性能', 'agent', '网络']
      }
    ]
  },
  {
    category: '告警配置 (Alerting)',
    icon: 'notifications_active',
    questions: [
      {
        id: 'email-alert',
        question: '为什么我收不到邮件告警？',
        answer: '请检查以下几点：确认您的邮箱地址在通知渠道中配置正确；检查垃圾邮件文件夹，发件人通常为 no-reply@logsystem.com；确认告警规则的触发条件是否真正被满足。',
        tags: ['邮件', '告警', '通知', '配置']
      },
      {
        id: 'silence-period',
        question: '如何设置告警静默期？',
        answer: '在"告警管理"页面，找到特定的告警规则，点击"编辑"。在高级设置中，您可以找到"静默时间"选项。您可以设置在告警触发后的一段时间内（例如 30 分钟）不再重复发送通知。',
        tags: ['静默', '告警', '配置', '规则']
      }
    ]
  },
  {
    category: '权限管理 (Permissions)',
    icon: 'security',
    questions: [
      {
        id: 'readonly-user',
        question: '如何添加新的只读用户？',
        answer: '进入"系统设置" -> "用户管理"。点击右上角的"新增用户"。输入用户的电子邮件地址，并在角色下拉菜单中选择"访客" (只读)。用户将收到一封包含激活链接的电子邮件。',
        tags: ['用户', '权限', '只读', '角色']
      }
    ]
  }
];

const popularTags = ['数据接入', '告警配置', '权限管理', '账单'];

const FAQ: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'yes' | 'no'>>({});

  const pageBg = isDark ? 'bg-[#0b1121]' : 'bg-slate-50';
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const cardOpenBg = isDark ? 'open:bg-[#232f48]' : 'open:bg-slate-50';
  const borderColor = isDark ? 'border-[#334155]' : 'border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-[#94a3b8]' : 'text-slate-600';
  const inputBg = isDark ? 'bg-[#1e293b]' : 'bg-white';
  const codeBg = isDark ? 'bg-black/30' : 'bg-slate-100';
  const kbdBg = isDark ? 'bg-[#0b1121]' : 'bg-slate-100';
  const feedbackBg = isDark ? 'bg-white/5' : 'bg-slate-100';
  const feedbackHover = isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200';

  const filteredFaqData = useMemo(() => {
    if (!searchTerm && !selectedTag) return faqData;
    const term = searchTerm.toLowerCase();
    return faqData.map(category => ({
      ...category,
      questions: category.questions.filter(q => {
        const matchesSearch = !searchTerm ||
          q.question.toLowerCase().includes(term) ||
          q.answer.toLowerCase().includes(term) ||
          q.tags.some(tag => tag.toLowerCase().includes(term));
        const matchesTag = !selectedTag ||
          q.tags.some(tag => tag.includes(selectedTag)) ||
          category.category.includes(selectedTag);
        return matchesSearch && matchesTag;
      })
    })).filter(category => category.questions.length > 0);
  }, [searchTerm, selectedTag]);

  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleFeedback = (questionId: string, helpful: 'yes' | 'no') => {
    setFeedbackGiven(prev => ({ ...prev, [questionId]: helpful }));
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag);
    setSearchTerm('');
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${pageBg} -mx-6 -mt-6 -mb-6`}>
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-12">
          {/* Hero / Search */}
          <div className="mb-12 flex flex-col items-center text-center">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#135bec]/20 text-[#135bec]">
              <span className="material-symbols-outlined text-3xl">live_help</span>
            </div>
            <h1 className={`mb-4 text-3xl font-bold tracking-tight ${textColor} md:text-4xl`}>常见问题解答</h1>
            <p className={`mb-8 max-w-2xl ${textSecondary}`}>这里汇集了关于日志接入、告警配置和权限管理的常见问题。如果您找不到答案，请联系我们的支持团队。</p>
            <div className="relative w-full max-w-2xl group">
              <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 ${textSecondary} group-focus-within:text-[#135bec] transition-colors`}>
                <span className="material-symbols-outlined text-lg">search</span>
              </div>
              <input
                id="faq-search"
                name="faqSearch"
                className={`block w-full rounded-xl border ${borderColor} ${inputBg} py-4 pl-12 pr-4 ${textColor} placeholder-[#94a3b8] shadow-lg ${isDark ? 'shadow-black/20' : 'shadow-slate-200/50'} focus:border-[#135bec] focus:outline-none focus:ring-1 focus:ring-[#135bec] transition-all`}
                placeholder="如何帮助您？ (例如: 配置 Logstash, 邮件告警失效)"
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedTag(null); }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className={`absolute inset-y-0 right-12 flex items-center px-2 ${textSecondary} hover:text-[#135bec]`}>
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
              <div className="absolute inset-y-0 right-2 flex items-center">
                <kbd className={`hidden rounded border ${borderColor} ${kbdBg} px-2 py-0.5 text-xs font-medium ${textSecondary} md:inline-block`}>⌘K</kbd>
              </div>
            </div>
            {(searchTerm || selectedTag) && (
              <div className={`mt-4 text-sm ${textSecondary}`}>
                找到 {filteredFaqData.reduce((acc, cat) => acc + cat.questions.length, 0)} 个相关问题
                {selectedTag && <button onClick={() => setSelectedTag(null)} className="ml-2 text-[#135bec] hover:text-[#1048c0]">清除筛选</button>}
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className={`text-sm ${textSecondary} py-1`}>热门搜索:</span>
              {popularTags.map((tag) => (
                <button key={tag} onClick={() => handleTagClick(tag)}
                  className={`rounded-full ${selectedTag === tag ? 'bg-[#135bec] text-white border-[#135bec]' : `${cardBg} border ${borderColor} ${textSecondary}`} px-3 py-1 text-sm hover:border-[#135bec]/50 ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}
                >{tag}</button>
              ))}
            </div>
          </div>

          {/* FAQ Categories */}
          <div className="space-y-10 pb-20">
            {filteredFaqData.length === 0 ? (
              <div className={`text-center py-12 ${textSecondary}`}>
                <span className="material-symbols-outlined text-4xl mb-4 block">search_off</span>
                <p>没有找到匹配的问题</p>
                <button onClick={() => { setSearchTerm(''); setSelectedTag(null); }} className="mt-4 text-[#135bec] hover:text-[#1048c0]">清除搜索条件</button>
              </div>
            ) : (
              filteredFaqData.map((category) => (
                <section key={category.category}>
                  <div className={`mb-4 flex items-center gap-3 border-b ${borderColor} pb-2`}>
                    <span className="material-symbols-outlined text-[#135bec]">{category.icon}</span>
                    <h2 className={`text-xl font-bold ${textColor}`}>{category.category}</h2>
                  </div>
                  <div className="space-y-3">
                    {category.questions.map((q) => (
                      <details key={q.id} open={expandedQuestions.has(q.id)}
                        className={`group rounded-xl border ${borderColor} ${cardBg} ${cardOpenBg} transition-colors`}>
                        <summary onClick={(e) => { e.preventDefault(); toggleQuestion(q.id); }}
                          className={`flex cursor-pointer list-none items-center justify-between p-5 font-medium ${textColor}`}>
                          <span>{q.question}</span>
                          <span className={`material-symbols-outlined ${textSecondary} transition ${expandedQuestions.has(q.id) ? 'rotate-180' : ''}`}>expand_more</span>
                        </summary>
                        {expandedQuestions.has(q.id) && (
                          <div className={`px-5 pb-5 pt-0 ${textSecondary}`}>
                            <p className="mb-4 text-sm leading-relaxed">{q.answer}</p>
                            {q.code && (
                              <pre className={`mb-4 overflow-x-auto rounded-lg ${codeBg} p-3 text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'} font-mono`}>
                                <code>{q.code}</code>
                              </pre>
                            )}
                            <div className={`flex items-center gap-4 border-t ${isDark ? 'border-white/5' : 'border-slate-200'} pt-4`}>
                              <span className="text-xs">这对您有帮助吗？</span>
                              <div className="flex gap-2">
                                {feedbackGiven[q.id] ? (
                                  <span className="text-xs text-[#10b981]">感谢您的反馈！</span>
                                ) : (
                                  <>
                                    <button onClick={() => handleFeedback(q.id, 'yes')}
                                      className={`flex items-center gap-1 rounded ${feedbackBg} px-2 py-1 text-xs ${feedbackHover} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>
                                      <span className="material-symbols-outlined text-[14px]">thumb_up</span> 是
                                    </button>
                                    <button onClick={() => handleFeedback(q.id, 'no')}
                                      className={`flex items-center gap-1 rounded ${feedbackBg} px-2 py-1 text-xs ${feedbackHover} ${isDark ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}>
                                      <span className="material-symbols-outlined text-[14px]">thumb_down</span> 否
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="group flex items-center gap-2 rounded-full bg-[#135bec] px-5 py-3 text-white shadow-lg shadow-[#135bec]/30 hover:bg-[#1048c0] hover:scale-105 transition-all">
          <span className="material-symbols-outlined">support_agent</span>
          <span className="font-medium">联系支持</span>
        </button>
      </div>
    </div>
  );
};

export default FAQ;
