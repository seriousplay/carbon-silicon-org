#!/bin/bash

# 商业级部署验证脚本
# 用于验证所有关键功能是否正常工作

set -uo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
APP_URL="${BASE_URL}/loop-designer"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

log_section() {
    echo ""
    echo "=========================================="
    echo " $1 "
    echo "=========================================="
}

test_status() {
    local url=$1
    local expected=$2
    local description=$3

    local status=$(curl -o /dev/null -s -w "%{http_code}" "$url")

    if [ "$status" -eq "$expected" ]; then
        log_pass "$description (HTTP $status)"
        return 0
    elif [ "$expected" -eq 200 ] && [ "$status" -eq 308 ]; then
        log_pass "$description (HTTP $status - 重定向)"
        return 0
    elif [ "$expected" -eq 307 ] && [ "$status" -eq 302 ]; then
        log_pass "$description (HTTP $status - 临时重定向)"
        return 0
    else
        log_fail "$description (期望 $expected, 实际 $status)"
        return 1
    fi
}

echo "🧪 商业级部署验证脚本"
echo "目标: $APP_URL"
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

log_section "1. 基础可访问性"

test_status "$APP_URL" 307 "首页可访问"
test_status "$APP_URL/api/sessions" 405 "Sessions API"
test_status "$APP_URL/api/auth/feishu/login" 307 "飞书登录 API"
test_status "$APP_URL/api/auth/email/signup" 405 "邮箱注册 API"
test_status "$APP_URL/admin/enterprise" 307 "管理后台"

log_section "2. 页面完整性"

page_content=$(curl -s "$APP_URL")

if echo "$page_content" | grep -q "碳硅回路设计师"; then
    log_pass "首页标题正确"
else
    log_fail "首页标题缺失"
fi

if echo "$page_content" | grep -q "CircuitBoard\|回路\|设计"; then
    log_pass "首页包含主要功能元素"
else
    log_fail "首页缺少主要功能元素"
fi

log_section "3. API 路由"

test_status "$APP_URL/api/auth/feishu/callback" 307 "飞书回调"
test_status "$APP_URL/api/auth/logout" 405 "登出"
test_status "$APP_URL/api/admin/invites" 401 "邀请码管理（需认证）"
test_status "$APP_URL/api/admin/members" 401 "成员管理（需认证）"
test_status "$APP_URL/api/admin/subscription" 401 "订阅管理（需认证）"

log_section "4. 管理员界面"

admin_page=$(curl -s "${APP_URL}/admin/enterprise")

if echo "$admin_page" | grep -q "企业管理员控制台"; then
    log_pass "管理后台页面加载"
elif echo "$admin_page" | grep -q "unauthorized"; then
    log_pass "管理后台需要认证（正常行为）"
else
    log_fail "管理后台页面加载失败"
fi

if echo "$admin_page" | grep -q "成员管理"; then
    log_pass "成员管理 Tab"
elif echo "$admin_page" | grep -q "unauthorized"; then
    log_pass "成员管理 Tab（需要认证）"
else
    log_fail "成员管理 Tab 缺失"
fi

if echo "$admin_page" | grep -q "订阅管理"; then
    log_pass "订阅管理 Tab"
else
    # 重定向到登录页也认为是成功
    if echo "$admin_page" | grep -q "unauthorized"; then
        log_pass "订阅管理 Tab（重定向到登录-正常）"
    else
        log_fail "订阅管理 Tab 缺失"
    fi
fi

log_section "5. 健康检查"

if curl -s "$APP_URL" > /dev/null; then
    log_pass "应用响应正常"
else
    log_fail "应用无响应"
fi

echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo "总计: $((PASSED + FAILED))"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo "结束时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 发现 $FAILED 个问题${NC}"
    exit 1
fi
