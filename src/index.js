export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 favicon.ico 请求（直接返回 404）
    if (url.pathname === '/favicon.ico') {
      return new Response(null, { status: 404 });
    }

    // 只处理 /gitlab-webhook 路径的 POST 请求
    if (request.method === 'POST' && url.pathname === '/gitlab-webhook') {
      try {
        // 从环境变量获取飞书 Webhook URL
        const FEISHU_WEBHOOK_URL = env.FEISHU_WEBHOOK_URL;

        // 验证环境变量是否配置
        if (!FEISHU_WEBHOOK_URL) {
          console.error('FEISHU_WEBHOOK_URL 环境变量未配置');
          return new Response('Webhook URL not configured', { status: 500 });
        }

        const gitlabData = await request.json();

        // 过滤非 MR 事件
        if (gitlabData.object_kind !== 'merge_request') {
          return new Response('ignored - not a merge request event', { status: 200 });
        }

        // 提取信息
        const {
          object_attributes: objAttrs = {},
          user: { name: userName = '未知用户' } = {},
          project: projectInfo = {},
          repository: repoInfo = {}
        } = gitlabData;

        const {
          title: mrTitle = '未知标题',
          state: mrState = 'unknown',
          url: mrUrl = '',
          action: mrAction = 'unknown',
          source_branch: sourceBranch = '',
          target_branch: targetBranch = '',
          created_at: createdAt = '',
          updated_at: updatedAt = '',
          merge_status: mergeStatus = ''
        } = objAttrs;

        // 项目信息（优先使用 project，其次使用 repository）
        const projectName = projectInfo.name || repoInfo.name || '未知项目';
        const projectPath = projectInfo.path_with_namespace || repoInfo.description || '';
        const projectUrl = projectInfo.web_url || repoInfo.homepage || '';

        // 根据 MR 状态和动作优化消息内容
        let actionIcon = '📝';
        let actionText = 'MR更新';
        switch (mrAction) {
          case 'open':
            actionIcon = '🔔';
            actionText = '新的合并请求';
            break;
          case 'merge':
            actionIcon = '✅';
            actionText = '已合并';
            break;
          case 'close':
            actionIcon = '❌';
            actionText = '已关闭';
            break;
          case 'reopen':
            actionIcon = '🔄';
            actionText = '重新打开';
            break;
          default:
            actionText = 'MR更新';
        }

        // 状态中文映射
        const stateMap = {
          'opened': '待审核',
          'closed': '已关闭',
          'merged': '已合并',
          'locked': '已锁定'
        };
        const stateText = stateMap[mrState] || mrState;

        // 合并状态映射
        const mergeStatusMap = {
          'can_be_merged': '✅ 可以合并',
          'cannot_be_merged': '❌ 有冲突，无法合并',
          'unchecked': '未检查',
          'checking': '检查中'
        };
        const mergeStatusText = mergeStatusMap[mergeStatus] || mergeStatus;

        // 格式化时间
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          return date.toLocaleString('zh-CN', { hour12: false });
        };

        // 构建飞书消息（使用富文本格式）
        const feishuMessage = {
          msg_type: "interactive",
          card: {
            config: {
              wide_screen_mode: true,
              enable_forward: true
            },
            header: {
              title: {
                tag: "plain_text",
                content: `${actionIcon} ${actionText} - ${projectName}`
              },
              template: mrAction === 'merge' ? 'green' : (mrAction === 'close' ? 'red' : 'blue')
            },
            elements: [
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**${mrTitle}**`
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**发起人**：${userName}`
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**状态**：${stateText}`
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**合并状态**：${mergeStatusText}`
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**分支**：\`${sourceBranch}\` → \`${targetBranch}\``
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**项目**：[${projectPath}](${projectUrl})`
                }
              },
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**创建时间**：${formatDate(createdAt)}`
                }
              },
              (updatedAt && updatedAt !== createdAt) ? {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: `**更新时间**：${formatDate(updatedAt)}`
                }
              } : null,
              {
                tag: "action",
                actions: [
                  {
                    tag: "button",
                    text: {
                      tag: "plain_text",
                      content: "查看详情"
                    },
                    url: mrUrl,
                    type: "primary"
                  },
                  {
                    tag: "button",
                    text: {
                      tag: "plain_text",
                      content: "查看项目"
                    },
                    url: projectUrl,
                    type: "default"
                  }
                ]
              }
            ].filter(element => element !== null)
          }
        };

        // 使用 ctx.waitUntil 在后台发送飞书消息，不阻塞响应
        ctx.waitUntil(
          fetch(FEISHU_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feishuMessage),
          })
          .then(async response => {
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
          .catch(err => {
            console.error('飞书发送失败:', err.message);
          })
        );

        // 立即返回成功响应
        return new Response(JSON.stringify({
          status: 'success',
          message: `MR event processed: ${mrAction}`,
          data: {
            title: mrTitle,
            action: mrAction,
            source_branch: sourceBranch,
            target_branch: targetBranch,
            project: projectName
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('处理GitLab Webhook失败:', error);
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 其他请求返回 404
    return new Response('Not Found', { status: 404 });
  }
}
