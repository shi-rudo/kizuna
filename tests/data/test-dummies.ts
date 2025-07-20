/**
 * Test interface for dependency injection testing.
 */
export interface TestInterface {
    doSomething(): string
}

/**
 * Simple test stub class with no dependencies.
 */
export class TestStub implements TestInterface {
    doSomething(): string {
        return "TestStub doSomething"
    }
}

/**
 * Test stub class with one constructor dependency.
 */
export class TestStubWithOneDependency implements TestInterface {
    private _testStub: TestStub;

    constructor(testStub: TestStub) {
        this._testStub = testStub;
    }

    doSomething(): string {
        return `${this._testStub.doSomething()}TestStubWithOneDependency doSomething`;
    }
}

/**
 * Test stub class with two constructor dependencies.
 */
export class TestStubWithTwoDependencies implements TestInterface {
    private _testStub: TestStub;
    private _testStub2: TestStubWithOneDependency;

    constructor(testStub: TestStub, testStub2: TestStubWithOneDependency) {
        this._testStub = testStub;
        this._testStub2 = testStub2;
    }

    doSomething(): string {
        return this._testStub.doSomething() + this._testStub2.doSomething();
    }
}

/**
 * Test stub class with interface dependency injection.
 */
export class TestStubWithInterfaceDependency implements TestInterface {
    private _testStub: TestStub;

    constructor(testInterface: TestInterface) {
        this._testStub = testInterface;
    }

    doSomething(): string {
        return `${this._testStub.doSomething()}TestStubWithInterfaceDependency doSomething`;
    }
}

/**
 * Test dummy class that tracks instance creation for lifecycle testing.
 * Each instance gets a unique incrementing value.
 */
export class TestDummy {
    private static _value: number = 0;
    private readonly _instance_value: number;

    constructor() {
        TestDummy._value++;
        this._instance_value = TestDummy._value;
    }

    getValue(): number {
        return this._instance_value;
    }
}
