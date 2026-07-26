## 单元测试规约

### 1. 测试框架与工具

- **主框架**：`pytest`（必选）
- **断言库**：内置 `assert` 语句
- **Mock 库**：``pytest-mock` 插件（按需）
- **覆盖率工具**：`pytest-cov`（按需）

### 2. 命名规范

| 元素  | 规则  | 示例   |
| ---- | ---- | ---- |
| 测试文件       | `test_<模块名>.py`     | `test_user_service.py` |
| 测试类（可选） | `Test<被测试类名>`     | `TestUserService` |
| 测试函数/方法  | `test_<被测行为>_<预期结果>` 或 `test_<场景>_<条件>_<预期>`   | `test_create_user_with_valid_email_succeeds` |
| 辅助函数/方法  | 以下划线开头，如 `_generate_fake_user()`，且在测试文件中定义为普通函数或 fixture | `_assert_user_fields_equal`      |

### 4. 测试编写原则

#### 4.1 AAA 结构

每个测试用例必须清晰划分为 **Arrange（准备）**、**Act（执行）**、**Assert（断言）** 三部分，用空行分隔。

```python
def test_calculate_discount_for_vip_user():
    # Arrange
    user = User(role="vip", years=3)
    order = Order(total=1000)

    # Act
    final_price = calculate_price(user, order)

    # Assert
    assert final_price == 850
```
