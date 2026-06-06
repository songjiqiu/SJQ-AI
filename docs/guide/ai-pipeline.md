# AI 流水线

## 当前能力

当前版本将创作工作台拆成三步页面，并在耗时操作之间使用独立等待页：

1. `/{locale}/workbench`：用户输入创作想法、资料文件、可选指定页数和 PPT 类型；资料文件上传后会先调用 `POST /api/decks/outline/files` 在服务端解析，返回 `parsedFiles`、`sources` 和 `warnings`，不落库、不生成 PPT。指定页数位于上传文件行右侧，范围 6-40，说明文字放在输入框下方；上传按钮只显示图标和“添加文件”，单文件大小限制显示在按钮后方，支持格式放在按钮下方。PPT 类型使用 4 列选项网格，保持现有分组、选项、样式和交互。输入页保持紧凑桌面规格：输入框、类型选项和右侧栏统一收紧高度、字号和间距，右侧栏显示最近大纲草稿与生成历史，并可直接删除当前账号下的草稿或历史；删除前使用应用内 shadcn/ui 风格确认弹窗；重置和生成大纲草稿操作位于右侧栏下方并使用整行宽按钮，与左侧表单底部对齐。
2. `/{locale}/workbench/outline/analyze/loading`：浏览器从 `sessionStorage` 读取初始输入并调用 `POST /api/decks/outline/analyze`，第一轮生成隐藏意图上下文（受众、目标、核心信息）、推荐页数和 L0-L3 轻量大纲；若用户指定了页数，推荐页数必须等于用户指定值。第一轮完成后等待页进入 8 秒拦截态，用户可点击“编辑结构”进入确认页，也可点击“立即生成草稿”或等待倒计时结束后自动继续。
3. `/{locale}/workbench/outline/analyze/confirm`：主要展示页数、PPT 类型、叙事风格、全局主题、章节结构和每页清单；受众、目标、核心信息继续作为隐藏上下文随 `confirmedPlan` 保存，不作为主要编辑项展示。PPT 类型只读展示，后续只能引用，不能由模型改写。调整页数时，确认页会按页数同步增减结构页和轻量大纲。
4. `/{locale}/workbench/outline/loading`：浏览器读取确认后的 `confirmedPlan` 并调用 `POST /api/decks/outline`。服务端依次生成统一视觉说明、每页详细大纲和每页可展示内容 JSON；每一阶段都会校验页数、PPT 类型和页序，已锁定的统一视觉说明与详细大纲由服务端持有并注入后续结果，失败时直接返回错误且不保存草稿。
5. `/{locale}/workbench/outline/{id}`：默认以只读卡片化视图展示已保存大纲，包含封面、目录、统一视觉说明、每页详细大纲和可展示内容 JSON；底部操作栏中间展示预览/编辑状态、页数和编辑入口，用户可直接生成预览 PPT，也可点击“编辑大纲”后修改整套标题、摘要、结构化统一视觉说明字段、每页详细大纲和 `contentBlocks`；底部操作栏提供删除入口，生成中的关联任务存在时会阻止删除。
6. `/{locale}/workbench/generate/loading`：浏览器从 `sessionStorage` 读取 `outlineDraftId` 并调用 `POST /api/decks/generate` 创建异步生成任务，随后轮询 `GET /api/decks/{id}/status`。若同一大纲 30 分钟内已有生成中任务，服务端会复用原任务，避免重复生成历史。生成任务使用固定 3 路并发生成页面图层 JSON、预览占位图和真实图片素材；前 `min(5, 总页数)` 页优先按页序落库，完成后返回 `previewReady: true`，前端可立即进入轻量预览。
7. `/{locale}/workbench/preview/{id}`：展示固定视口三栏预览编辑器，顶部操作区居中显示内容审核与一致性评分，评分卡只常驻显示标题和分数，摘要通过鼠标悬停或键盘聚焦时的 shadcn/ui 风格提示框显示，并在删除按钮左侧提供“统一视觉说明”按钮，点击后以大弹窗只读展示完整统一视觉规范；“统一视觉说明”按钮后提供“设计质量评分”按钮，跳转到 `/{locale}/workbench/preview/{id}/quality` 独立页面，展示每页总分、五维评分、问题、建议、自动修复状态、选中版式与候选版式。左侧为页面缩略图，中间为 16:9 图层画布和底部上下结构元信息区：上方展示“选中元素”编辑器，负责编辑文本内容、位置和大小，图片、图标等文件类元素提供上传新文件和删除；下方只保留图片图层请求，选中图片元素时会高亮对应请求并自动滚动到可见位置。右侧栏整块区域展示“本页内容”面板，面板合并 `contentBlocks` 与全部画布图层：已绑定页面元素的内容块显示元素类型图标、图层层级、`contentBlocks.type`、`content` 和优先级，未绑定内容块标记“未落版”，未绑定图片、形状、图标、图表、背景和装饰等元素追加为可点击图层条目；点击内容块、图层条目或画布元素会同步高亮，语义元素可携带 `styleRole` 用于绑定统一视觉规范角色；点击“编辑正文条目”后只修改 `bodyPoints` 并同步到画布正文/卡片文本元素；同时提供当前页保存、换模板、重新生成当前页、PPTX 下载和生成历史删除。若项目仍为 `GENERATING`，预览页显示后台进度并定时刷新，编辑、重新生成、删除和 PPTX 下载在最终 `READY` 前保持禁用。

大纲草稿生成采用严格分阶段 LLM 流程。第一轮基于用户文本、文件摘要/片段、服务端 `sourceId` 来源、PPT 类型和可选指定页数，生成隐藏意图上下文、推荐页数和 `lightweightOutline`，只覆盖 L0 全局主题、L1 章节、L2 页面清单、L3 每页叙事角色/核心意图。轻量大纲根字段为 `deckTitle`、`deckType`、`narrativeStyle`、`pageCount`、`globalTheme`、`chapters`、`pages`；每页只写 `pageNumber`、`pageType`、`layoutType`、`title`、`purpose`、`keyMessage`、`sourceIds`、`chapterId`、`narrativeRole`。第一轮不生成 `contentBlocks`、正文段落、图表数据、图片关键词、坐标、元素层级或具体视觉样式，并立即校验页数、连续页码、章节覆盖、章节重叠、来源 ID 和叙事顺序；兼容用 `structureOutline` 由服务端从轻量大纲派生。第二轮基于用户确认后的完整 JSON、原始输入、文件摘要/片段、截断来源上下文和 PPT 类型，只生成统一全局视觉规范；第三轮基于已锁定结构和视觉说明生成每页详细大纲，只决定每页讲什么，不输出 `contentBlocks`、`contentLayers`、`bodyPoints`、`unifiedVisualSpec` 或最终展示文案；第四轮基于已锁定详细大纲生成每页可展示内容 JSON，只输出标题、副标题、正文要点、`contentBlocks` 和 `contentLayers`，不回传 `unifiedVisualSpec` 或 `detailedOutline`。已锁定统一视觉说明和详细大纲由服务端持有并注入最终结果；若模型改写页数、`deckType` 或页序，服务端直接失败且不保存草稿，不自动修复或保存部分结果。最终保存的每页 `SlideContent` 除标题、副标题、正文要点、演讲目标和视觉意图外，还必须包含 `pageType`、`contentBlocks`、`coreStatement`、`narrativeRole`、`contentLayers`、`slideTransition`、`explanationDepth`、`sourceRequirement`、`adaptationRules`、`audienceFocus`、`viewerObjective`、`contentBoundary`。其中 `contentBlocks` canonical 结构为 `{ type, content, priority, sourceIds }`，用于承载标题、正文、列表、图片说明、表格、图表、引用、标注、数字指标、对比项、时间轴、步骤、总结、结论、来源、图片、主视觉和背景图需求等可落版信息；允许类型为 `heading`、`text`、`list`、`image`、`table`、`chart`、`quote`、`callout`、`metric`、`comparison`、`timeline`、`steps`、`summary`、`conclusion`、`source`。`contentLayers` 只保存 `primary`、`supporting`、`supplementary` 三组 0-based `contentBlocks` 下标，每个内容块必须且只能归入一层，不能生成或保存与 `contentBlocks` 相似的额外文本。第四阶段严格校验前会对已有 `contentBlocks` 做窄口径归一化，兼容旧 `{ blockType, text, priority }`，忽略空白、常见标点、书名号、大小写和“页脚 / 页眉 / 备注 / 主题 / 课件主题”等装饰前缀去重，作者信息会合并“作者：X”和“X”这类重复表达，封面页课程、课件、版本、年级和册次等装饰性元信息只保留一条；归一化常见非法类型与超界 `priority`，过滤不存在的 `sourceIds`，并按优先级保留最多 12 条；旧字符串版 `contentLayers` 会按文本匹配到内容块索引，未匹配且未达到 12 条时追加为 `text` 内容块后引用。旧草稿缺少这些字段时，读取层会从标题、正文要点、核心表达和内容块索引自动补齐；旧预览或历史页面读取时也会重新清理重复内容块，并重映射可展示内容补齐层生成的元素绑定。

统一全局视觉规范在第二轮生成后写入大纲草稿，后续页面图层编排、图片生成和预览 PPT 生成只能引用并遵循，不重新生成或修改。统一视觉规范只保存结构化 JSON；“全局视觉统一规范”文档作为隐藏生成标准，要求 AI 按基础信息、PPT 类型视觉基调、色彩系统、版式字体、图片规则、组件元素和高级规则输出字段内容，但不作为页面内容展示，也不新增 Markdown 全文存储字段。服务端在生成、读取和保存大纲草稿时都会归一化统一视觉规范，并对规则数组、图片规则、视觉关键词、禁用规则和透明度规则做去重；历史 JSON 或 AI 输出中的超长说明会按 schema 上限截断，确保预览页读取生成历史时仍能通过结构校验；去重后不足 schema 最小数量时再用默认规则补齐。`themeName` 作为主体名称，和 `visualStyle`、`designIntent`、`usageConvenience` 一起描述基础信息。

`colorPalette` 使用分组对象，不再保存旧版字符串数组：`primary` 恰好 1 个、`secondary` 2-3 个、`chart` 4-8 个、`neutral` 2-4 个、`accent` 1-2 个；每个颜色都是 `{ name, hex, usage }`，`hex` 必须是大写 `#RRGGBB`。PPT 生成链路会把用户选择的 `palette` 预设作为唯一 HEX 来源，AI 只能围绕服务端锁定色板改写名称、用途和角色说明，不能自行发明、替换或扩展颜色。`colorRoles` 记录背景、卡片/表面、标题、正文、强调、高亮、图表、装饰、边框/分隔线和对比度要求；角色中的 HEX 只能来自最终色板，额外只允许 `#000000` 与 `#FFFFFF`，读取归一化会按角色分组和正文/背景对比度重新收敛。`transparencyRules` 只用 `{ baseHex, opacity, usage }` 表达透明度语义，`baseHex` 必须来自最终色板，用于遮罩、弱背景、悬浮层或分隔线等场景；若模型返回未声明的透明度基色，读取归一化会丢弃该规则，并基于当前最终色板补齐弱背景、分隔线和选中态透明度规则。历史草稿中的旧 `string[] colorPalette` 会在读取或 AI 输出归一化时自动转成新分组对象，不需要数据库迁移。

`pageSpec` 固定说明 16:9、`1920 x 1080px`、`13.333 x 7.5 inch`、安全边距 `0.5`、安全边距像素范围和 12 栏栅格，`gridGutterPx` 默认 `24`。`typographyRules` 保存默认字号、最小字号、最大行数、行高、字体 fallback、`scale` 和 `textLimits`；字体 fallback 在生成与读取归一化时会去重，历史草稿中的重复字体仍可被预览层兼容展示；`scale` 覆盖封面标题、封面副标题、页标题、小节标题、正文、注释、图表标签和图标标签，`textLimits` 保存标题行数、bullet 字数、注释长度、图标标签长度和禁止大段正文规则。`imageRules` 保存 `imageType`、`aspectRatio`、`forbiddenItems`、`imagePromptStyle`、背景图避开高对比文字区域和主体避开标题区要求，图片 prompt 会拼接分组色板和 `imagePromptStyle`。

新增 `componentRules` 独立覆盖卡片、标签、数字指标、表格、图表、图标与轻量元素规范；高级规范继续包括 `pptTypeVisualTone`、`informationDensityRules`、`layoutRules`、`chartVisualRules`、`imageIllustrationRules`、`iconStyleRules`、`emphasisRules`、`forbiddenVisualRules`。`layoutRules` 是结构化布局规则来源，包含 `pageMargin`、`sectionGap`、`elementGap`、`whitespace` 四个子项；历史草稿中的旧 `spacingRules`、旧数组 `layoutRules` 会在读取时兼容归一化，历史数据如带有旧全文字段会被忽略且不回写。工作台只读展示采用摘要优先：基础信息、PPT 类型视觉基调、色彩系统、关键版式字体、图片规则和一致性规则默认展开，完整字号层级与高级规则默认折叠；色彩系统使用紧凑色卡展示“色块 + 色码 + 用途 + 关联角色”，图片生成/使用规则、规则清单和高级规则使用与“版式与字体”一致的两列信息卡展示，避免横向标签或列表行堆叠。工作台编辑态仍保留完整结构化字段，把图片生成/使用规则与图片/插画风格规范合并到“图片生成/使用规则”，把 `forbiddenRules` 与 `forbiddenVisualRules` 去重合并为“禁用规则”，支持逐条新增、删除并保持原有结构化字段写回。

`pptTypeVisualTone` 由 `deckType` 自动匹配，只保存 `deckType`、`deckTypeName`、`recommendedTone` 和 `visualKeywords`，前端只展示匹配后的视觉基调与关键词；历史四类对照结构会在读取时按当前 `deckType` 自动归一化为单项结果。当前映射覆盖现有 20 个可选 PPT 类型，商务办公、销售市场、教学培训、研究分析和个人展示仅作为分组原则，不新增为可选类型。`themeName` 只表达内容主题或视觉主题，不拼接、不保留“星图 / 矩阵 / 深空 / 晨雾 / 月白 / 竹青 / 黛蓝 / 胭脂 / 鎏金 / 玄墨 / Star Map”等外观配色预设名；历史草稿和模型输出会在读取时自动清理并补齐新增结构字段，旧版色彩完整定义会并入 `colorRoles`，旧版字号层级会并入 `typographyRules.scale`。工作台展示统一视觉说明时，色彩系统会把分组 `colorPalette` 与 `colorRoles` 合并为“色块 + 色码 + 用途 + 关联角色”的去重视图，颜色角色只关联色板内色值或允许的纯黑/纯白，便于人工检查颜色；编辑模式仍保留色板和颜色角色微调入口。预览页的页面缩略图、主画布、图片 Mock、图片 prompt 和 PPTX 导出也会解析同一套分组色板与 `colorRoles` 作为页面背景、文字、卡片、图表、边框和装饰色；模板库、语义资产库或历史元素中保存的固定颜色只在应用到页面时重映射到当前统一色板，不会改写资产库原始数据。输入中的 `deckType` 决定 PPT 的场景结构、视觉基调与页面组织方式，默认 `business-report`（商务汇报）；deck-level `style` 已从新输入、prompt 和输出结构中移除，历史 JSON 中残留该字段时只会被读取兼容并在归一化后丢弃。

预览 PPT 生成必须复用已保存的大纲草稿，不重新拆页。单页编排采用“语义规划 -> 模板选择 -> 服务端排版 -> 可展示内容落版补齐 -> 语义资产增强 -> 图层生成 -> PPTX 合成”流程：LLM 先输出 `SemanticSlidePlan`，判断 `pageIntent`（对应用户术语 `page_role`、`primary_goal`、`core_message`、`audience_takeaway`、`content_density`）、三层 `contentHierarchy.tiers` 和无坐标的 `semanticElements`；`contentHierarchy` 从 `contentLayers` 索引解析 `contentBlocks` 文本，只表达层级，不额外产生可见内容。`semanticElements` 必须覆盖本页 `content.contentBlocks` 的每一个 `block.content`，不能只输出标题、结论和少量正文。覆盖内容块的语义元素必须写 `contentBlockIndex`，值为 `contentBlocks` 的 0-based 下标；语义元素还应写 `styleRole`，例如 `page-title`、`key-message`、`body`、`body-list`、`metric`、`chart`、`table`、`quote`、`callout`、`comparison`、`timeline`、`steps`、`summary`、`conclusion`、`source-note`、`hero-visual`、`supporting-visual`。每层 `tiers.items` 必须至少 1 条，若兼容模型在 fallback 中返回空层级，服务端会在严格校验前用页面副标题、来源要求或讲解备注补足空 `items`，但仍保持最终 zod schema 不放宽。语义编排 prompt 只传入结构化 `unifiedVisualSpec`；实际颜色、字号、尺寸和画布渲染也以结构化字段为准。随后从固定 `layoutType` 中选择 2-3 个候选写入 `layoutSelection.candidates`，比较适配理由、风险和分数，并给出 `selectedLayoutType`；同时写入 `constraints`，记录安全边距、主标题唯一、核心信息存在、图片主体避让标题区和密度限制。固定 `layoutType` 使用 camelCase 字段保存，取值为 `chapter`、`cover-title`、`title-body-points`、`big-image-background`、`left-image-right-text`、`left-text-right-image`、`left-text-right-chart`、`big-chart`、`two-column-compare`、`quote`、`time-axis`、`process-steps`、`key-metrics`、`quadrant-matrix`、`ending`，这些取值与管理员模板库 15 个固定分类一一对应。

服务端会按 `selectedLayoutType` 和候选顺序读取 `isEnabled=true` 的 `PptTemplate`，优先使用同分类模板坐标和元素结构；同分类多模板时会结合模板标签、PPT 类型视觉基调关键词、页面角色、内容密度和 `sortOrder` 评分，例如 AI/科技类优先“AI 科技感”，商务报告/方案类优先“中国商务通用”，研究/咨询类优先“极简咨询风”。套用模板时保留模板 `canvas`、元素坐标和图片占位关系，但替换为当前页标题、核心表达、`contentBlocks` 非标题内容、来源/页码和图片提示词，并在 `designPlan.visualStrategy` 与 `layoutDiagnostics.warnings` 记录使用的模板名称与 ID。模板正文位不足或内置排版把多个内容块合并到一个文本框时，归一化补齐层会移除聚合正文框，把未绑定的 `contentBlocks` 拆为紧凑文本元素并分配 `contentBlockIndex`；最终每页元素上限为 24，`motionPlan.elements` 与页面元素使用同一上限，`contentBlocks` 仍最多 12 个。模板库未导入、分类无启用模板或模板套用后未通过 schema 校验时，服务端会回退到内置确定性排版，并记录“未命中启用模板”或“模板套用失败”的诊断，不中断生成。模板或内置排版产出页面 JSON 后，服务端会调用语义元素资产增强层，分别检索文本样式、容器、线条、图形、图标和导航六类启用且审核通过的 `TemplateAsset` 资产：文本样式会调整文本元素字号、字重、颜色、行高和最大行数；容器、图形和线条会写入形状/线条样式；图标和导航会绑定已有元素或在元素数未达上限时补充轻量辅助元素。资产检索失败、缺表、未命中或资源不适配时保留原页面并写入 `layoutDiagnostics.warnings`。

LLM 在语义阶段禁止输出 `bounds`、`x/y/width/height`、`zIndex`、`textStyle` 或图片请求；坐标只由服务端模板套用层或内置排版层生成。生成元素和图片请求后会通过 zod 校验字段完整性、元素类型合法性、主标题唯一性、核心信息存在性、图片请求引用完整性和版式类型合法性。随后服务端输出逐页 `designQualityScore`，五维包括 `informationHierarchy`、`visualConsistency`、`contentDensity`、`renderability`、`expressionCompleteness`；如果仍存在未绑定 `contentBlocks`，表达完整性会扣分并写入“页面可展示内容未完全落版”问题。当总分低于 `78` 或任一维低于 `65` 时，会把评分问题、原始语义计划和统一视觉说明发回同一 LLM 自动修复一次，修复后重新走模板选择与套用。修复不得改变 `slideId`、`index` 或页数，也不得删除低优先级 `contentBlocks` 对应的语义元素；修复失败或修复后仍低分时保留最佳版本，并在 `repairStatus` 标记 `failed` 或 `still-low`，不阻断整套生成。以上 `layoutSelection`、`constraints`、`designQualityScore` 与原有 `pageIntent`、`contentHierarchy`、`semanticElements` 一起写入 `DeckSlide.pageDesign`，历史数据缺失时读取层会补齐默认值。旧预览读取时只做兼容归一化，不自动新增缺失元素；需要修复旧页面时使用“重新生成当前页”。

数据页会优先识别指标、维度、趋势和对比关系；流程页优先识别步骤、顺序、输入输出和依赖关系；对比页优先识别比较对象、比较维度和差异结论。每页最多一个主视觉中心，高密度页面会优先使用表格、矩阵、流程、指标卡片等紧凑信息图版式，并在 `layoutDiagnostics` 标记需要关注的密度风险。后台生成使用固定 3 路并发编排页面，并先为图片图层写入默认 Mock SVG 占位图、保存页面 JSON；首批页面按页序落库并可预览后，继续并发生成剩余页面、真实图片和质量审核，最后按页序读取页面合成 PPTX 并标记 `READY`。页面坐标使用 inch，默认 16:9 画布为 `13.333 x 7.5`，安全边距 `0.5`；`pageSpec.gridColumns=12` 当前作为统一视觉说明和后续排版约束保存，本版本不对既有确定性坐标算法做 12 栏吸附。图片生成优先读取当前账号默认图片模型及其关联供应商，推荐模型 ID 为 `gpt-image-2`；单张图片生成和图片 URL 下载默认 120 秒超时，可通过 `IMAGE_REQUEST_TIMEOUT_MS` 调整；若供应商未配置 API Key、调用失败或超时，会回退到可插拔 Mock SVG 图层并在 provider 与 metadata 中标记回退来源。PPTX 使用 `pptxgenjs@4.0.1` 静态导出。

图片素材会先按账号内缓存复用。缓存 key 由当前账号、图片模型、图片类型、比例、透明背景、完整 prompt、avoid、关键词和统一视觉风格归一化后生成。若存在 `APPROVED` 且本地文件仍可读取的素材，会复制登记为当前 `DeckProject` 的 `DeckAsset`，继续沿用现有鉴权下载逻辑；未命中时才调用图片模型。生成后先做规则质量审核，包括 MIME、文件大小、尺寸、fallback 状态和禁用内容；视觉 LLM 审核是可选增强，单次审核默认 30 秒超时，默认模型不支持图片输入或审核超时时记录为 `rules-only-fallback`，不会阻断生成。

布局计算会检测越界、文字溢出、元素重叠和页面密度。标题最多 2 行，正文每页最多 5 个信息块；标题字号 22-34，副标题 16-22，正文 12-18，注释 8-11。中文换行按字符宽度估算，中文字符约 `fontSize * 0.55 / 72` inch，行高默认 `1.25`。统一视觉规范中的 `typographyRules` 会同步记录默认字号、最小字号、最大行数、行高、字体 fallback 和字号等级，供后续页面编排、人工编辑和图片提示词引用；文本元素 `textStyle.maxLines` 与统一视觉规范保持一致，允许范围为 `1-9`。溢出修复顺序为降低字号、压缩正文、调整版式、生成拆页建议、标记需要用户确认；当前版本不会自动增加页数。

首版已加入 Web 预览动效、内容审核提示和一致性评分。PPTX 暂不写入 PowerPoint 原生对象动画，但会把 `motionPlan` 写入演讲者备注和产物 metadata，便于后续接入 OOXML 动画后处理。读取历史预览时会校验 `motionPlan` 与当前页面元素的引用关系；若动效元数据无效、超出当前 schema 或引用不存在的元素，会按页面元素重新生成动效计划。

登录用户可在“体验设置”中配置 AI 供应商、LLM 模型、图片模型和向量模型。三类模型都复用供应商的 Base URL 与 API Key。大纲草稿和从大纲生成单页编排时都会优先读取当前账号启用的默认 LLM 模型；没有默认模型时回退到 `.env` 中的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`AI_TEXT_MODEL`；仍无 API Key 时使用本地模拟。图片图层生成会优先读取默认图片模型关联供应商；没有可用供应商 API Key 时读取 `.env` 中的 `IMAGE_API_KEY`、`IMAGE_BASE_URL`、`AI_IMAGE_MODEL`；仍不可用时使用本地 Mock SVG。

## 环境变量

```bash
OPENAI_API_KEY=      # OpenAI-compatible API Key，留空则使用本地模拟 fallback
OPENAI_BASE_URL=     # 可选，兼容服务商 base URL
AI_TEXT_MODEL=       # 可选，默认 gpt-4.1-mini
IMAGE_API_KEY=       # 可选，OpenAI-compatible 图片生成 API Key，留空则图片图层使用本地模拟
IMAGE_BASE_URL=      # 可选，图片生成兼容服务商 base URL
AI_IMAGE_MODEL=      # 可选，默认 gpt-image-2
IMAGE_REQUEST_TIMEOUT_MS=120000 # 可选，单张图片生成/下载超时，默认 120 秒，允许范围 10000-600000
DATABASE_URL=        # MySQL 连接串，例如 mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
```

## 服务端接口

`POST /api/decks/outline/files`

资料文件解析接口，要求用户已登录。请求为 `multipart/form-data`，字段名为 `files`，最多 5 个文件，单文件最大 10MB。该接口只解析文件并返回结构化结果，不创建大纲草稿、不保存数据库、不启动 PPT 生成。

支持格式：

- 文本类：`.txt`、`.md`、`.markdown`、`.csv`、`.json`，直接读取并切块。
- Office 现代格式：`.docx` 使用 `mammoth` 提取正文；`.pptx` 使用 `jszip` 读取 slides、notes、标题和正文 XML；`.xlsx` 使用 `xlsx` 读取 sheet、表头、关键行和表格摘要。
- PDF：使用 `pdfjs-dist` 优先提取可复制文本；低文本页会使用 `@napi-rs/canvas` 渲染后交给 `tesseract.js` OCR，OCR 文本写入运行时缓存以复用重复解析结果。
- 图片：使用 `tesseract.js`，默认 `chi_sim+eng` OCR；当当前账号有可用默认 LLM 配置时，会额外调用兼容视觉模型生成一句简短视觉说明，失败时保留 OCR 文本和 warning。

返回字段：

- `parsedFiles`：每个文件的 `id`、文件名、大小、解析器类型、摘要、关键点、可用文本、`sourceIds` 和文件级警告。
- `sources`：服务端稳定生成的来源切块，`sourceId` 格式如 `src_f001_c001`，包含文件名、来源类型、页码/页序/sheet 信息和截断文本。
- `warnings`：全局解析警告。旧版 `.doc`、`.ppt`、`.xls` 会返回“请另存为 .docx/.pptx/.xlsx 后上传”的明确提示。

`POST /api/decks/outline/analyze`

第一轮输入分析接口。请求字段：

- `idea`：创作想法，必填。
- `sourceText`：兼容旧调用的补充文本字段，当前创作输入页不再展示该入口，前端固定传空字符串。
- `parsedFiles`：由 `POST /api/decks/outline/files` 返回的文件解析结果；新输入页只传该字段，不再传旧文件正文格式。
- `sources`：由文件解析接口返回的来源切块，LLM 只能引用已有 `sourceId`，服务端会校验 `parsedFiles.sourceIds` 与 `sources` 是否一致。
- `textFiles`：旧调用兼容字段，最多 5 个，单文件最大 10MB；兼容读取 `.txt`、`.md`、`.markdown`、`.csv`、`.json`、`.docx`，新输入页不再传该格式。
- `pageCount`：可选指定页数，范围 6-40；未填写时由模型推荐页数，填写时 `recommendedPageCount` 必须与该值一致。
- `deckType`：PPT 类型，默认 `business-report`，按使用场景分组展示。
- `palette`：配色预设。
- `locale`：`zh-CN` 或 `en-US`。

所有新请求都会先按 `GenerationInput` 约束校验：`idea`、`parsedFiles`、`sources`、`deckType`、`pageCount`、`palette`、`locale`、完整 `allowedContentBlockTypes` 枚举，以及 `maxContentBlocksPerPage=12`。返回字段包括原始 `input`、带 `summary` / `snippets` 的 `fileSummaries`、不可变 `deckType`、`audience`、`goal`、`coreMessage`、`recommendedPageCount`、`lightweightOutline` 和兼容用 `structureOutline`。`lightweightOutline` 包含 `deckTitle`、`deckType`、`narrativeStyle`、`pageCount`、`globalTheme`、`chapters`、`pages`；`pageCount` 必须等于 `pages.length`，章节 `pageRange` 必须覆盖全部页面且不能重叠，每页 `sourceIds` 只能引用输入 `sources`。第一轮禁止输出 `contentBlocks`、正文段落、图表数据、图片关键词、坐标、元素层级和具体视觉样式。确认页会展示原始创作想法摘要、叙事风格、全局主题、章节结构、页面清单和文件摘要，文件只展示文件名、大小、字数和摘要，不展开完整正文。该接口不写数据库，前端只将结果暂存在浏览器会话中等待用户确认。

`POST /api/decks/outline`

确认后的大纲草稿生成接口。除第一轮输入字段外，还必须传入 `confirmedPlan`：

- `confirmedPlan.input`：第一轮原始输入快照；其中 `deckType`、`palette`、`locale` 必须与本次请求一致。
- `confirmedPlan.fileSummaries`：第一轮文件摘要和片段。
- `confirmedPlan.deckType`：必须与原始 `deckType` 完全一致。
- `confirmedPlan.audience`、`confirmedPlan.goal`、`confirmedPlan.coreMessage`：确认后的目标受众、表达目标和核心信息。
- `confirmedPlan.recommendedPageCount`：确认后的最终页数，范围 6-40；必须等于 `structureOutline.slides.length`。
- `confirmedPlan.lightweightOutline`：用户确认或修改后的 L0-L3 轻量大纲；后续阶段只能引用其页数、页序、章节归属、`pageType`、`layoutType` 和 `narrativeStyle`，不能改写。
- `confirmedPlan.structureOutline`：用户确认或修改后的结构大纲。后续 LLM 只能基于它生成统一视觉说明、每页详细大纲和可展示内容 JSON，不能重写 PPT 类型、页数或页序。

内置 PPT 类型包括：

- 商务办公：`business-report`、`fundraising-pitch`、`proposal`、`project-plan`、`retrospective-summary`。
- 销售市场：`product-launch`、`sales-proposal`、`brand-marketing`、`event-promotion`、`operation-plan`、`growth-experiment`。
- 教学培训：`training-course`、`knowledge-sharing`、`teaching-deck`。
- 研究分析：`research-report`、`data-analysis`、`industry-insight`。
- 个人展示：`portfolio`、`personal-review`、`community-sharing`。

历史数据中的 deck-level `style` 字段会被 schema 读取兼容并在归一化后丢弃；新输入页不再展示该字段，LLM prompt 不再要求输出或锁定该字段。

返回字段：

- `id`：大纲草稿 ID。
- `mode`：`ai-json` 或 `mock`。
- `deckTitle`、`deckSummary`：整套 PPT 标题与摘要。
- `input`、`fileSummaries`、`intentAnalysis`：合并后传入 LLM 的输入、文件摘要和用户确认后的第一轮完整 JSON。
- `unifiedVisualSpec`：第二轮生成并锁定的统一全局视觉规范，后续生成只能引用并遵循。
- `slides`：每页标题、副标题、页面类型、可落版内容模块、正文要点、演讲目标、视觉意图，以及结构化的核心表达句、叙事作用、内容层级、页间衔接、讲解深度、来源要求、拆合规则、受众关注点、行动或认知目标和内容边界。
- `createdAt`、`updatedAt`：草稿创建与更新时间。

草稿接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/decks/outline` | 当前账号最近 20 条大纲草稿；作为工作台侧栏快捷入口，读取时会跳过不符合当前结构约束的历史草稿，本地未执行大纲草稿表迁移时返回空列表 |
| `GET` | `/api/decks/outline/{id}` | 当前账号某个大纲草稿 |
| `PATCH` | `/api/decks/outline/{id}` | 保存编辑后的大纲 JSON |
| `DELETE` | `/api/decks/outline/{id}` | 删除当前账号的大纲草稿；若草稿正在被 `GENERATING` 任务引用，返回 `ACTIVE_GENERATION_EXISTS` |

预览 PPT 生成必须复用已保存的大纲 JSON，不能重新拆页。大纲确认页默认只读展示已保存内容；只有用户进入编辑模式并保存后，`PATCH` 才会更新草稿。

`POST /api/decks/generate`

请求字段：

- `outlineDraftId`：当前账号下已保存的大纲草稿 ID。

接口要求用户已登录。服务端会读取当前用户的大纲草稿并创建异步生成任务，立即返回生成历史 ID 与 `GENERATING` 状态。若同一账号、同一大纲草稿在 30 分钟内已有 `GENERATING` 任务，则直接返回该任务并不重复启动后台 runner；超过 30 分钟仍未完成的旧任务会标记为 `FAILED`，用户可重新生成。当前版本使用数据库状态和 Next.js 进程内后台 runner，不引入 Redis/BullMQ。

返回字段：

- `id`、`status`、`progress`：生成历史 ID、状态与进度。
- `previewReady`：前 `min(5, 总页数)` 页已可预览时为 `true`。

`GET /api/decks/{id}/status`

查询异步生成状态。返回字段包括 `id`、`status`、`progress`、`previewReady`、`previewUrl`、`error` 和 `details`。当状态为 `READY` 或 `previewReady=true` 时，前端进入 `/{locale}/workbench/preview/{id}`；当状态为 `FAILED` 时，后台会把页面图层 LLM、图片生成、质量审核、PPTX 合成等任意阶段的异常写入 `DeckProject.generationError` 与 `generationProgress.message`，接口优先返回 `generationError`，为空时回退到 `progress.message`。等待页只有明确收到 `FAILED` 才显示“预览 PPT 生成失败”；长时间仍为 `GENERATING` 时显示“生成仍在后台继续”，并继续低频轮询，任务完成后仍会自动进入预览。若状态异常但项目已具备 PPTX 产物和完整页面，状态接口会修正为 `READY` 并返回预览地址，避免已完成产物被失败兜底降级。

`PATCH /api/decks/{id}/slides/{slideId}`

保存当前页内容和元素位置。服务端会重新计算布局诊断、更新页面 JSON，并立即重新合成 PPTX，使下载文件反映最新编辑。

`POST /api/decks/{id}/slides/{slideId}/elements/{elementId}/file`

为图片、图标等文件类元素上传替换图片。服务端会保存为当前 PPT 的图片图层资产并返回图层记录，前端把它写入当前页后，随“保存当前页”一起重新合成 PPTX。

`POST /api/decks/{id}/slides/{slideId}/regenerate`

重新生成当前页。服务端会调用当前账号默认 LLM 对本页文案重新生成页面图层 JSON，新增或变化的图片请求继续走账号内缓存和图片模型。
- `mode`：`ai-json` 或 `mock`。
- `deckTitle`、`deckSummary`：整套 PPT 标题与摘要。
- `input`、`unifiedVisualSpec`：用户输入与统一视觉说明。
- `contentReview`：内容审核分数、风险等级、提示和建议。
- `consistencyReport`：跨页一致性评分、检查项和建议。
- `slides`：每页文案、元素编排、图片图层请求、生成后的图片图层、Web 动效计划。
- `pptxUrl`：静态 PPTX 下载地址。

历史与产物接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/decks` | 当前账号最近 20 条已完成且具备 PPTX 产物的 PPT 生成历史 |
| `GET` | `/api/decks/{id}` | 当前账号某个 PPT 的完整结果 |
| `DELETE` | `/api/decks/{id}` | 删除当前账号的生成历史，并清理 `storage/decks/{id}` 下的 PPTX 与图片图层产物；生成中项目返回 `ACTIVE_GENERATION_EXISTS` |
| `GET` | `/api/decks/{id}/pptx` | 下载该 PPT 的 PPTX 文件 |
| `GET` | `/api/decks/{id}/assets/{assetId}` | 读取该 PPT 的图片图层 |

图片模型配置接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/image-models` | 当前账号图片模型配置列表 |
| `POST` | `/api/ai/image-models` | 新增图片模型配置，请求体与 LLM 模型一致，默认模型 ID 可填 `gpt-image-2` |
| `PATCH` | `/api/ai/image-models/{id}` | 更新图片模型供应商、显示名称、模型 ID、默认温度、启用状态或默认状态 |
| `DELETE` | `/api/ai/image-models/{id}` | 删除图片模型配置 |
| `POST` | `/api/ai/image-models/{id}/default` | 设置默认图片模型 |

向量模型配置接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/embedding-models` | 当前账号向量模型配置列表 |
| `POST` | `/api/ai/embedding-models` | 新增向量模型配置，请求体与 LLM 模型一致 |
| `PATCH` | `/api/ai/embedding-models/{id}` | 更新向量模型供应商、显示名称、模型 ID、默认温度、启用状态或默认状态 |
| `DELETE` | `/api/ai/embedding-models/{id}` | 删除向量模型配置 |
| `POST` | `/api/ai/embedding-models/{id}/default` | 设置默认向量模型 |

旧的 `POST /api/decks/analyze` 仍保留为拆页与单页编排调试接口，前端工作台预览生成默认使用 `/api/decks/generate` 并只传入 `outlineDraftId`。

管理端模板接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/templates` | 管理员读取全局 PPT 模板列表，可按固定分类过滤 |
| `POST` | `/api/admin/templates` | 在指定分类下创建模板；未传 `slide` 时复制该分类默认样板 |
| `GET` | `/api/admin/templates/{id}` | 读取某个模板详情 |
| `PATCH` | `/api/admin/templates/{id}` | 更新模板元数据、启用状态、排序或完整页面 JSON |
| `DELETE` | `/api/admin/templates/{id}` | 删除模板 |

模板库已自动接入创作工作台生成流程的单页模板选择：生成时只读取启用模板，按 `layoutSelection` 候选分类和视觉基调评分选择具体模板；未命中或校验失败时回退内置排版。语义元素资产库也已接入生成主链路，模板或内置排版完成后会按页面类型、页面语义、语义标签、风格标签和背景适配检索六类资源，并把结果写入元素的 `assetBinding` 与 `assetStyle`。预览页“换模板”仍保留为独立编辑功能，后续可复用同一套模板选择与套用逻辑。保存模板时，`slide` 必须通过 `SlideCompositionPlan` schema 校验；图片元素仍需通过 `imageRequestId` 关联 `imageLayerRequests`。

## 结构约定

页面坐标使用 inch，画布固定为 `13.333 x 7.5` 的 16:9。旧历史数据如果仍使用 0-100 百分比，会在读取时转换为 inch。`SlideElement` 支持 `text`、`generatedImage`、`shape`、`icon`、`chartPlaceholder`，并带有 `semanticType`、`hierarchyLevel`、`textStyle` 和 `editable`；语义资产增强后还可带有 `assetBinding` 与 `assetStyle`，用于记录命中的资产 ID、类型、套装、语义 key、匹配分和渲染样式。`LINE` 资产当前仍落到 `shape` 元素上，通过 `assetBinding.kind` 与 `assetStyle.lineType` 区分。当元素类型为 `generatedImage` 时，必须通过 `imageRequestId` 关联 `imageLayerRequests`，生成完成后再关联 `generatedImageLayers`。`DeckSlide.pageDesign` 会保存内部语义元数据，包括 `pageIntent`、增强后的 `contentHierarchy`、`designPlan`、`layoutDiagnostics` 和 `semanticElements`；旧历史数据缺少这些字段时，读取层会按现有文案补齐兼容默认值，不需要数据库迁移。

所有 AI 输出都必须通过 zod 校验。模型不能返回 Markdown、代码围栏或 JSON 前后的解释文本；若返回内容是纯 JSON 代码围栏，服务端会先剥离围栏再解析，但带解释文本的响应仍会判定失败。为兼容 DeepSeek 等 OpenAI-compatible 服务暂不支持 `response_format: {"type":"json_schema"}` 的情况，若接口明确返回 `response_format` 不可用或不支持，服务端会再发起一次不携带 `response_format` 的纯 JSON 提示兜底；若模型返回的内容看起来已经是 JSON、但仍因字符串转义或语法错误无法解析，服务端会把截断后的原始输出交给同一模型做一次纯格式修复，修复结果仍必须通过原 schema 校验。

大纲草稿的第 2-4 阶段禁用 schema 校验失败后的模型改写重试。第一轮轻量大纲会在输出后立即做 JSON schema 和一致性校验：`pageCount` 必须等于 `pages.length`，页码必须从 1 连续到 `pageCount`，章节范围必须覆盖全部页面且不能重叠，`pageType` 必须来自页面角色枚举，`layoutType` 必须来自 15 个模板分类，`sourceIds` 必须来自输入资料，且递归拒绝 `contentBlocks`、`bodyPoints`、`subtitle`、图表数据、图片 prompt/keywords、坐标尺寸、`zIndex`、`textStyle` 和元素层级等字段。统一视觉说明可以做结构化视觉规范的窄口径归一化；第三阶段 schema 只接受 `deckType` 和 `slides`，第四阶段 schema 只接受 `deckType` 和可展示内容 `slides`，服务端会把已锁定统一视觉说明和详细大纲注入最终结果。第四阶段可展示内容 JSON 会把已有 `contentBlocks` 的旧字段 `{ blockType, text }` 归一化为 canonical `{ type, content }`，并处理常见非法类型、超界 `priority`、空字段、近重复块和不存在的 `sourceIds`，但仍不接受缺失的 `slideId`、`index`、标题或整页 `contentBlocks`。这些字段缺失、错配、页数不一致、`deckType` 被改写，或额外返回 `locale`、`palette`、`pageCount` 等顶层字段时，都会直接失败；模型额外回传的 `unifiedVisualSpec` 或 `detailedOutline` 会被忽略，不参与一致性判断。单页语义编排仍会在最终校验前窄口径补齐 `contentHierarchy.tiers`：保留有效层级与条目，若某层缺失、错位、`items` 为空或条目结构不合法，则使用同页标题、正文、副标题、来源要求或讲解备注补足该层。

`AI_JSON_GENERATION_FAILED` 会在响应 `details` 中返回结构化诊断，字段包括 `message`、`schemaName`、`model` 和 `attempts`。每个 attempt 记录 `mode`、`stage`、`error`，并在可用时附带 `zodIssues` 与截断后的 `responseSnippet`。前端等待页会展示中文摘要和“失败详情 / Failure details”折叠区，便于定位是模型不支持 `response_format`、JSON 语法错误、Markdown 包裹、字段类型错误、页数不匹配，还是其他 schema 校验失败。普通未知错误会统一返回 `INTERNAL_ERROR`，并在脱敏后的 `details.message` 中保留失败原因；诊断不包含 API Key、Authorization header、密码或完整请求 prompt。

## 数据与文件

Prisma 使用 `DeckOutlineDraft` 保存账号维度的大纲草稿；`DeckProject`、`DeckSlide`、`DeckAsset` 继续保存生成历史、页面 JSON、图片图层索引和 PPTX 索引。`PptTemplate` 保存管理员维护的全局模板库，包含固定分类、自定义分类预留字段、名称、说明、标签、排序、启用状态和完整 `SlideCompositionPlan` JSON。删除大纲草稿只删除草稿记录，不影响已完成生成历史；删除生成历史会依赖数据库级联删除页面和资产记录，并清理对应本地项目目录。`ReusableImageAsset` 保存账号内可复用图片素材元数据，数据库只保存元数据，本地文件仍写入 `storage/`，不会因删除某个生成历史而清理账号级复用缓存。运行时文件写入：

```text
storage/decks/
storage/assets/
```

这些目录只保留 `.gitkeep`，实际生成的 SVG、图片缓存和 PPTX 文件不提交。`storage/decks/{projectId}` 保存单个 PPT 项目的图片图层与 PPTX 产物，`storage/assets/{userId}` 保存账号级可复用图片素材缓存，`storage/ocr` 保存 OCR 运行时文本缓存且不提交。文件解析返回的 `parsedFiles`、`sources` 和来源摘要会复用现有大纲 JSON 字段，不新增数据库表。后续接入 Cloudflare R2 或其他 S3-compatible 对象存储时，可替换当前本地存储实现并保持 API URL 语义稳定。

## 后续方向

- 扩展更多图片生成 provider 的返回格式兼容，并沿用当前 `ImageLayerGenerator` 接口。
- 后续可将当前进程内后台 runner 替换为 BullMQ/Redis 队列，继续复用 `DeckProject.status`。
- 增强内容审核为可配置策略，支持严格拦截模式。
- 将 Web 动效计划映射到可编辑时间线，并探索 PowerPoint 动画兼容写入。
