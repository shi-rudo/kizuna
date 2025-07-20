import { expect, test } from 'vitest';
import { ContainerBuilder } from '../../src/api/container-builder';

class MyService {
  constructor(public name: string) {}
}

test('should register and resolve a service end-to-end', () => {
  const services = new ContainerBuilder();
  services.addSingleton(r => r.fromType(MyService).withDependencies());

  const serviceProvider = services.build();
  const myService = serviceProvider.get(MyService);

  expect(myService).toBeInstanceOf(MyService);
  
});
