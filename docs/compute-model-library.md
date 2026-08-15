# 计算中心模型库

## 目标

计算中心不是“堆包仓库”，而是一个受治理的模型执行层：所有模型必须有明确输入、边界、执行器、失败方式和可验证输出；禁止上传任意 Python/Shell，禁止模型自行联网，保持单任务锁、超时、重复任务拒绝和 fail-closed。

## 两层结构

1. **本地有界模型**：轻量、确定性模型直接在 Worker 中运行，用于三圈商圈、Huff、合成 OD、竞品分流、可达性、多指标指数、贝叶斯证据融合、决策矩阵、Markov、PageRank、阈值传播、M/M/1、盈亏平衡、Black-Scholes 等。
2. **Kaggle 专业模型栈**：计量经济、机器学习、组合优化、因果推断、贝叶斯网络、ABM、离散事件、H3/GIS、投资组合、敏感性分析、生存分析等。只允许注册表中的模型模板，不接受任意代码。

## 位置商业模型链

情报中心提供 WorldPop、GHSL、Overture、Foursquare、NASA Black Marble、DLR WSF、Copernicus LCFM，以及现有中国地图/POI/道路数据；计算中心按任务使用下列链路：

`统一空间网格/H3 -> 人口与建筑/POI聚合 -> 可达性 -> 三圈 -> Huff -> 合成OD -> 竞品分流 -> 时序活力 -> 不确定性区间`

其中真实客流校准当前明确为 **deferred**。以后收集公开客流、节假日客流、人工计数或其他合法真实样本后，先进入治理基准库，再启用校准与回测；在此之前不得把模型估算称为真实 LBS 客流。

## 领域覆盖

模型注册表覆盖：位置与商圈、金融投资、商业经营、情报分析、社会行为与群体心理、政策与经济、运营与供应链、营销增长、风险可靠性、房地产城市、交通流动、能源环境、公共健康。

人群心理模型只用于群体层面的行为假设、选择/扩散/意见动力学和不确定性分析，不用于声称读取或确定某个具体个人的内心状态。

## 专业 Python 模型栈

- core: NumPy, SciPy, pandas, scikit-learn, statsmodels
- optimization: CVXPY, OR-Tools
- finance: PyPortfolioOpt, arch
- causal/bayesian: DoWhy, pgmpy
- simulation/network: Mesa, SimPy, NetworkX
- geospatial: H3, Shapely, pyproj
- sensitivity/survival: SALib, lifelines

Kaggle 运行环境的实际包可用性必须通过运行时导入审计确认；没有通过审计的包不得标记为生产可用。缺包时优先采用已存在的稳定包/纯算法实现，而不是运行时联网 pip install。

## 稳定性原则

- 一个任务一次只走一个最小模型组合。
- 能用闭式解/本地模型就不启动 Kaggle。
- 轻量分析优先本地；重数值/统计/优化走 Kaggle CPU；大规模并行或明确 GPU 算法才走 T4。
- GIS/遥感优先 Earth Engine/openEO；精确符号数学优先 Wolfram。
- 所有模型返回方法名、输入摘要、参数、结果和必要的不确定性信息；禁止把代理指标伪装成观测事实。
