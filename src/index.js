export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// 处理根路径 GET 请求（健康检查/默认响应）
		if (request.method === 'GET' && url.pathname === '/') {
			return new Response('Hello Webhooks!', { status: 200 });
		}

		// 处理 favicon.ico 请求（直接返回 404）
		if (url.pathname === '/favicon.ico') {
			return new Response(null, { status: 404 });
		}

		// 只处理 /gitlab-webhook 路径的 POST 请求
		if (request.method === 'POST' && url.pathname === '/gitlab-webhook') {
			try {
				const gitlabData = await request.json();

				// 过滤非 MR 事件
				if (gitlabData.object_kind !== 'merge_request') {
					return new Response('ignored - not a merge request event', { status: 200 });
				}

				// 从环境变量获取飞书 Webhook URL
				const FEISHU_WEBHOOK_URL = env.FEISHU_WEBHOOK_URL;

				// 验证环境变量是否配置
				if (!FEISHU_WEBHOOK_URL) {
					console.error('FEISHU_WEBHOOK_URL 环境变量未配置');
					return new Response('Webhook URL not configured', { status: 500 });
				}

				// 提取信息
				const {
					object_attributes: objAttrs = {},
					user: { name: userName = '未知用户' } = {},
					project: projectInfo = {},
					repository: repoInfo = {},
				} = gitlabData;

				const {
					title: mrTitle = '未知标题',
					state: mrState = 'unknown',
					url: mrUrl = '',
					action: mrAction = 'unknown',
					source_branch: sourceBranch = '',
					target_branch: targetBranch = '',
					merge_status: mergeStatus = '',
				} = objAttrs;

				// 项目信息（优先使用 project，其次使用 repository）
				const projectName = projectInfo.name || repoInfo.name || '未知项目';
				const projectPath = projectInfo.path_with_namespace || repoInfo.description || '';
				const projectUrl = projectInfo.web_url || repoInfo.homepage || '';

				// 根据 MR 状态和动作优化消息内容
				let actionText = '';
				switch (mrAction) {
					case 'open':
						actionText = '🔔合并请求';
						break;
					case 'merge':
						actionText = '✅已合并';
						break;
					case 'close':
						actionText = '❌合并已关闭';
						break;
					case 'reopen':
						actionText = '🔄合并重新打开';
						break;
					default:
						actionText = '📝MR更新';
				}

				// 状态中文映射
				const stateMap = {
					opened: '待审核',
					closed: '已关闭',
					merged: '已合并',
					locked: '已锁定',
				};
				const stateText = stateMap[mrState] || mrState;

				// 合并状态映射
				const mergeStatusMap = {
					can_be_merged: '可以合并',
					cannot_be_merged: '有冲突，无法合并',
					unchecked: '未检查',
					checking: '检查中',
				};
				const mergeStatusText = mergeStatusMap[mergeStatus] || mergeStatus;

				// 构建更美观的飞书消息（支持飞书富文本）
				const feishuMessage = {
					msg_type: 'post',
					content: {
						post: {
							zh_cn: {
								title: `${actionText} - ${projectName}`,
								content: [
									[
										{
											tag: 'text',
											text: `功能: ${mrTitle}\n`,
										},
									],
									[
										{
											tag: 'text',
											text: `发起人: ${userName}\n`,
										},
									],
									[
										{
											tag: 'text',
											text: `状态: ${stateText}\n`,
										},
									],
									[
										{
											tag: 'text',
											text: `合并状态: ${mergeStatusText}\n`,
										},
									],
									[
										{
											tag: 'text',
											text: `分支: ${sourceBranch} → ${targetBranch}\n`,
										},
									],

									[
										{
											tag: 'a',
											text: `${projectUrl}`,
											href: mrUrl,
										},
									],
								],
							},
						},
					},
				};

				// 使用 ctx.waitUntil 在后台发送飞书消息，不阻塞响应
				ctx.waitUntil(
					fetch(FEISHU_WEBHOOK_URL, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(feishuMessage),
					})
						.then(async (response) => {
							if (!response.ok) {
								throw new Error(`HTTP ${response.status}: ${response.statusText}`);
							}
							const result = await response.json();
							if (result.code !== 0) {
								console.error('飞书API返回错误:', result.msg || JSON.stringify(result));
							} else {
								console.log(`✅ MR消息已发送: ${mrTitle} (${mrAction}) - ${sourceBranch} → ${targetBranch}`);
							}
						})
						.catch((err) => {
							console.error('飞书发送失败:', err.message);
						}),
				);

				// 立即返回成功响应
				return new Response(
					JSON.stringify({
						status: 'success',
						message: `MR event processed: ${mrAction}`,
						data: {
							title: mrTitle,
							action: mrAction,
							source_branch: sourceBranch,
							target_branch: targetBranch,
							project: projectName,
						},
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			} catch (error) {
				console.error('处理GitLab Webhook失败:', error);
				return new Response(
					JSON.stringify({
						status: 'error',
						message: error.message,
					}),
					{
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}
		}

		// 其他请求返回 404
		return new Response('Not Found', { status: 404 });
	},
};
